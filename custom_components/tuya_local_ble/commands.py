"""One lock command at a time for Raykube battery locks.

The lock serves one BLE command at a time, so commands sent in quick
succession used to queue up and run minutes later. Rules:

- lock is always accepted: it drops a pending unlock or calibration that
  has not reached the lock yet, and a second lock joins the first;
- unlock and calibration are refused while another command is pending,
  and for COMMAND_COOLDOWN seconds after any command (e.g. no second unlock
  right after locking or unlocking);
- calibration is refused for CALIBRATION_COOLDOWN seconds after the last one.

Each write also has a deadline in the protocol layer
(TuyaBLEDevice.command_deadline); a command that misses it is dropped and
reported as an error instead of running later.
"""
from __future__ import annotations

import asyncio
import contextlib
import logging
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from weakref import WeakKeyDictionary

from homeassistant.exceptions import HomeAssistantError

from .const import DOMAIN
from .tuya_ble import TuyaBLEDataPointType, TuyaBLEDevice
from .tuya_ble.exceptions import TuyaBLECommandTimeoutError, TuyaBLEError
from .tuya_ble.tuya_ble import BLEAK_EXCEPTIONS

_LOGGER = logging.getLogger(__name__)

COMMAND_LOCK = "lock"
COMMAND_UNLOCK = "unlock"
COMMAND_CALIBRATE = "calibrate"

CALIBRATION_COOLDOWN = 120
COMMAND_COOLDOWN = 30


class LockCommandGuard:
    """Serialises the commands sent to one lock."""

    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._kind: str | None = None
        self._last_calibration: float | None = None  # time.time()
        self._last_command: float | None = None  # time.time()

    @property
    def pending(self) -> str | None:
        """Kind of the command still on its way to the lock."""
        if self._task is not None and not self._task.done():
            return self._kind
        return None

    @property
    def last_calibration(self) -> float | None:
        return self._last_calibration

    def unlock_blocked_until(self) -> float | None:
        """time.time() until which unlock is refused; None = allowed. Lock never waits."""
        if self._last_command is None:
            return None
        until = self._last_command + COMMAND_COOLDOWN
        return until if until > time.time() else None

    def calibration_blocked_until(self) -> float | None:
        """time.time() until which calibration is refused; None = allowed."""
        candidates = [self.unlock_blocked_until()]
        if self._last_calibration is not None:
            candidates.append(self._last_calibration + CALIBRATION_COOLDOWN)
        until = max((c for c in candidates if c is not None), default=None)
        return until if until is not None and until > time.time() else None

    def unlock_blocked_for(self) -> float:
        """Seconds until unlock may be sent again (0 = now)."""
        until = self.unlock_blocked_until()
        return max(0.0, until - time.time()) if until else 0.0

    def calibration_blocked_for(self) -> float:
        """Seconds until calibration may run again (0 = now)."""
        until = self.calibration_blocked_until()
        return max(0.0, until - time.time()) if until else 0.0

    async def run(self, kind: str, send: Callable[[], Awaitable[None]]) -> None:
        pending = self.pending
        if pending is not None:
            if kind != COMMAND_LOCK:
                raise HomeAssistantError(
                    translation_domain=DOMAIN,
                    translation_key="command_pending",
                    translation_placeholders={"command": pending},
                )
            if pending == COMMAND_LOCK:
                await self._wait(asyncio.shield(self._task))
                return
            # Lock wins: the pending unlock / calibration must not go out late.
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await self._task
        if kind == COMMAND_UNLOCK:
            blocked = self.unlock_blocked_for()
            if blocked > 0:
                raise HomeAssistantError(
                    translation_domain=DOMAIN,
                    translation_key="command_cooldown",
                    translation_placeholders={"seconds": str(int(blocked) + 1)},
                )
        if kind == COMMAND_CALIBRATE:
            blocked = self.calibration_blocked_for()
            if blocked > 0:
                raise HomeAssistantError(
                    translation_domain=DOMAIN,
                    translation_key="calibration_cooldown",
                    translation_placeholders={"seconds": str(int(blocked) + 1)},
                )
        # Counted from the request: a command that timed out may still have
        # reached the lock.
        now = time.time()
        self._last_command = now
        if kind == COMMAND_CALIBRATE:
            self._last_calibration = now
        self._kind = kind
        self._task = asyncio.ensure_future(send())
        await self._wait(self._task)

    @staticmethod
    async def _wait(task: Awaitable[None]) -> None:
        try:
            await task
        except TuyaBLECommandTimeoutError as exc:
            raise HomeAssistantError(
                translation_domain=DOMAIN,
                translation_key="command_timeout",
                translation_placeholders={"seconds": f"{exc.deadline:g}"},
            ) from exc
        except asyncio.CancelledError:
            if asyncio.current_task() is not None and asyncio.current_task().cancelling():
                raise  # our caller was cancelled
            raise HomeAssistantError(
                translation_domain=DOMAIN, translation_key="command_replaced"
            ) from None


_guards: WeakKeyDictionary[TuyaBLEDevice, LockCommandGuard] = WeakKeyDictionary()


def get_command_guard(device: TuyaBLEDevice) -> LockCommandGuard:
    guard = _guards.get(device)
    if guard is None:
        guard = _guards[device] = LockCommandGuard()
    return guard


async def async_calibrate(device: TuyaBLEDevice, dp_id: int, value: int) -> None:
    """Start the lock's calibration (special_function), once per cooldown."""
    async def send() -> None:
        datapoint = device.datapoints.get_or_create(
            dp_id, TuyaBLEDataPointType.DT_ENUM, value
        )
        await datapoint.set_value(value)

    await get_command_guard(device).run(COMMAND_CALIBRATE, send)


@contextlib.asynccontextmanager
async def friendly_errors(device: TuyaBLEDevice, action: str) -> AsyncIterator[None]:
    """Turn BLE / protocol exceptions into short, translated messages.

    The UI shows the message (the card adds the translation key as the error
    code); the original exception goes to the log.
    """
    try:
        yield
    except HomeAssistantError:
        raise
    except TuyaBLECommandTimeoutError as exc:
        raise HomeAssistantError(
            translation_domain=DOMAIN,
            translation_key="command_timeout",
            translation_placeholders={"seconds": f"{exc.deadline:g}"},
        ) from exc
    except TimeoutError as exc:
        _LOGGER.warning("%s: %s: no response from the lock", device.address, action)
        raise HomeAssistantError(
            translation_domain=DOMAIN, translation_key="lock_no_response"
        ) from exc
    except BLEAK_EXCEPTIONS as exc:
        _LOGGER.warning("%s: %s: lock not reachable: %r", device.address, action, exc)
        raise HomeAssistantError(
            translation_domain=DOMAIN, translation_key="lock_unreachable"
        ) from exc
    except TuyaBLEError as exc:
        _LOGGER.warning("%s: %s: lock error: %r", device.address, action, exc)
        raise HomeAssistantError(
            translation_domain=DOMAIN, translation_key="lock_error"
        ) from exc
    except Exception as exc:  # noqa: BLE001 - shown as a generic message, logged in full
        _LOGGER.exception("%s: %s failed", device.address, action)
        raise HomeAssistantError(
            translation_domain=DOMAIN, translation_key="command_failed"
        ) from exc
