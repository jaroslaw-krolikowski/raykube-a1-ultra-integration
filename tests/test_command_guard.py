"""Lock commands never run late (17.10 incident): deadlines, one command at a
time, lock always allowed, calibration only once per cooldown.

Skipped when homeassistant is not installed.
"""
from __future__ import annotations

import asyncio
import base64
from types import SimpleNamespace
from unittest.mock import patch

import pytest

pytest.importorskip("homeassistant")

from homeassistant.components.lock import LockState  # noqa: E402
from homeassistant.core import HomeAssistant  # noqa: E402
from homeassistant.exceptions import HomeAssistantError  # noqa: E402
from homeassistant.helpers import frame  # noqa: E402

from custom_components.tuya_local_ble import commands  # noqa: E402
from custom_components.tuya_local_ble import lock as lock_platform  # noqa: E402
from custom_components.tuya_local_ble.devices import (  # noqa: E402
    TuyaBLECoordinator,
    get_device_product_info,
)
from custom_components.tuya_local_ble.tuya_ble import (  # noqa: E402
    SOURCE_DEVICE,
    TuyaBLEDevice,
    TuyaBLEDeviceCredentials,
)
from custom_components.tuya_local_ble.tuya_ble import tuya_ble as protocol  # noqa: E402
from custom_components.tuya_local_ble.tuya_ble.exceptions import (  # noqa: E402
    TuyaBLECommandTimeoutError,
)

UNLOCK_CHECK = base64.b64encode(
    bytes.fromhex("0001ffff") + b"12345678" + bytes.fromhex("01aabbccdd0000")
).decode()

UNLOCK = "000000000147"
LOCK = "00000000012e"
CALIBRATE = "000000000144"  # DP68 special_function


class FakeLock:
    """A lock whose BLE link can be held busy, like a lock out of reach."""

    def __init__(self) -> None:
        self.sent: list[str] = []
        self.busy = asyncio.Event()
        self.busy.set()
        self.busy_lock = asyncio.Lock()  # one command at a time, as in BLE

    async def send_packet(self, code, data, wait_for_response=True):
        async with self.busy_lock:
            await self.busy.wait()
            self.sent.append(bytes(data)[:6].hex())


async def make_lock(hass: HomeAssistant):
    device = TuyaBLEDevice(None, SimpleNamespace(address="AA:BB:CC:DD:EE:FF", name="lock"))
    device._device_info = TuyaBLEDeviceCredentials(
        "uuid", "localkey12345678", "devid", "jtmspro", "hc7n0urm",
        "A1 Ultra", "A1 Ultra", "A1 Ultra", UNLOCK_CHECK,
    )
    fake = FakeLock()
    device._send_packet = fake.send_packet

    async def no_update():
        pass

    device.update = no_update
    coordinator = TuyaBLECoordinator(hass, device)
    entity = lock_platform.TuyaBLELock(
        hass, coordinator, device, get_device_product_info(device),
        lock_platform.get_mapping_by_device(device)[0],
    )
    entity.hass = hass
    entity.entity_id = "lock.test"
    entity.async_write_ha_state = lambda: None
    coordinator.async_add_listener(entity._handle_coordinator_update)
    return device, entity, fake


def run(scenario):
    async def wrapper():
        hass = HomeAssistant("/tmp")
        frame.async_setup(hass)
        await hass.async_start()
        try:
            await scenario(hass)
        finally:
            await hass.async_stop(force=True)

    asyncio.run(wrapper())


def short_deadlines(command: float = 0.3, lock: float = 0.6):
    return patch.multiple(protocol, COMMAND_DEADLINE=command, LOCK_COMMAND_DEADLINE=lock)


def test_command_that_misses_its_deadline_is_dropped_not_sent_later():
    async def scenario(hass):
        device, entity, fake = await make_lock(hass)
        fake.busy.clear()  # lock out of reach
        with short_deadlines(), patch.object(lock_platform, "RAYKUBE_CONFIRM_TIMEOUT", 5):
            with pytest.raises(HomeAssistantError) as err:
                await entity.async_unlock()
            assert err.value.translation_key == "command_timeout"
            assert entity.state is None  # still unknown, not "unlocked"
            assert entity.extra_state_attributes["command_confirmed"] is False
            assert "dropped" in device.connection.last_error

            fake.busy.set()  # the lock is back
            await asyncio.sleep(0.2)
            assert UNLOCK not in fake.sent  # never unlocks minutes later
            assert device.datapoints[6].value is False  # write rolled back

    run(scenario)


def test_calibration_pressed_several_times_runs_once():
    """17.10: three presses during a lag, two calibrations minutes later."""
    async def scenario(hass):
        device, entity, fake = await make_lock(hass)
        fake.busy.clear()
        with short_deadlines(command=0.5):
            first = asyncio.ensure_future(entity.async_calibrate())
            await asyncio.sleep(0.05)
            for _ in range(2):
                with pytest.raises(HomeAssistantError) as err:
                    await entity.async_calibrate()
                assert err.value.translation_key == "command_pending"
            fake.busy.set()
            await first
            assert fake.sent.count(CALIBRATE) == 1

            with pytest.raises(HomeAssistantError) as err:
                await entity.async_calibrate()  # within the 2 min cooldown
            assert err.value.translation_key == "calibration_cooldown"
            assert fake.sent.count(CALIBRATE) == 1
            attrs = entity.extra_state_attributes
            assert attrs["last_calibration"] and attrs["calibration_blocked_until"]

    run(scenario)


def test_lock_is_always_possible():
    async def scenario(hass):
        device, entity, fake = await make_lock(hass)
        # The 30 s unlock block has its own test; here unlock may follow lock.
        with patch.object(lock_platform, "RAYKUBE_CONFIRM_TIMEOUT", 5), patch.object(
            commands, "COMMAND_COOLDOWN", 0
        ):
            await entity.async_calibrate()  # starts the calibration cooldown
            await entity.async_lock()  # cooldown does not block locking
            assert fake.sent == [CALIBRATE, LOCK]

            # A pending unlock is dropped when lock is pressed.
            fake.busy.clear()
            unlock = asyncio.ensure_future(entity.async_unlock())
            await asyncio.sleep(0.05)
            lock = asyncio.ensure_future(entity.async_lock())
            await asyncio.sleep(0.05)
            with pytest.raises(HomeAssistantError) as err:
                await unlock
            assert err.value.translation_key == "command_replaced"
            fake.busy.set()
            await lock
            assert fake.sent == [CALIBRATE, LOCK, LOCK]  # no unlock went out
            assert entity.state == LockState.LOCKING

            # Unlock is refused while a lock is on its way; a second lock joins it.
            fake.busy.clear()
            lock = asyncio.ensure_future(entity.async_lock())
            await asyncio.sleep(0.05)
            with pytest.raises(HomeAssistantError) as err:
                await entity.async_unlock()
            assert err.value.translation_key == "command_pending"
            again = asyncio.ensure_future(entity.async_lock())
            fake.busy.set()
            await asyncio.gather(lock, again)
            assert fake.sent == [CALIBRATE, LOCK, LOCK, LOCK]

    run(scenario)


def test_lock_waits_longer_than_unlock():
    assert TuyaBLEDevice.command_deadline([46]) > TuyaBLEDevice.command_deadline([6])
    assert TuyaBLEDevice.command_deadline([68]) == TuyaBLEDevice.command_deadline([6])


def test_failed_setting_write_keeps_the_reported_value():
    async def scenario(hass):
        device, entity, fake = await make_lock(hass)
        device._parse_datapoints_v4(bytes.fromhex("00000000400000" "2101000101"))  # DP33 on
        dp33 = device.datapoints[33]
        assert dp33.value is True and dp33.source == SOURCE_DEVICE
        fake.busy.clear()
        with short_deadlines():
            with pytest.raises(TuyaBLECommandTimeoutError):
                await dp33.set_value(False)
        assert dp33.value is True and dp33.source == SOURCE_DEVICE
        assert not any(c.dp_id == 33 and c.new is False for c in device.datapoints.changes)

    run(scenario)


def test_guard_is_per_device():
    a = TuyaBLEDevice(None, SimpleNamespace(address="AA:BB:CC:DD:EE:01", name="a"))
    b = TuyaBLEDevice(None, SimpleNamespace(address="AA:BB:CC:DD:EE:02", name="b"))
    assert commands.get_command_guard(a) is commands.get_command_guard(a)
    assert commands.get_command_guard(a) is not commands.get_command_guard(b)


def test_calibrate_button_shares_the_cooldown_with_the_card():
    from custom_components.tuya_local_ble import button
    from custom_components.tuya_local_ble.raykube import get_raykube_config

    async def scenario(hass):
        device, entity, fake = await make_lock(hass)
        config = get_raykube_config(device)
        press = button.TuyaBLERaykubeCalibrateButton(
            hass, entity.coordinator, device, get_device_product_info(device),
            config.dp("special_function"), config,
        )
        assert press.entity_registry_enabled_default  # the button stays available
        await press.async_press()
        with pytest.raises(HomeAssistantError) as err:
            await press.async_press()
        assert err.value.translation_key == "calibration_cooldown"
        with pytest.raises(HomeAssistantError):
            await entity.async_calibrate()  # the card's action too
        assert fake.sent.count(CALIBRATE) == 1

    run(scenario)


def test_no_second_unlock_for_30_s_after_a_command():
    async def scenario(hass):
        device, entity, fake = await make_lock(hass)
        with patch.object(lock_platform, "RAYKUBE_CONFIRM_TIMEOUT", 5):
            await entity.async_lock()
            attrs = entity.extra_state_attributes
            assert attrs["unlock_blocked_until"] and attrs["calibration_blocked_until"]
            with pytest.raises(HomeAssistantError) as err:
                await entity.async_unlock()  # right after locking
            assert err.value.translation_key == "command_cooldown"
            with pytest.raises(HomeAssistantError) as err:
                await entity.async_calibrate()
            assert err.value.translation_key == "calibration_cooldown"
            await entity.async_lock()  # locking never waits
            assert fake.sent == [LOCK, LOCK]

            with patch.object(commands, "COMMAND_COOLDOWN", 0):
                await entity.async_unlock()
            with pytest.raises(HomeAssistantError) as err:
                await entity.async_unlock()  # a second unlock
            assert err.value.translation_key == "command_cooldown"
            assert fake.sent == [LOCK, LOCK, UNLOCK]

            guard = commands.get_command_guard(device)
            guard._last_command -= commands.COMMAND_COOLDOWN  # 30 s later
            assert entity.extra_state_attributes["unlock_blocked_until"] is None
            await entity.async_unlock()
            assert fake.sent == [LOCK, LOCK, UNLOCK, UNLOCK]

    run(scenario)


def test_errors_reach_the_user_as_short_messages():
    from custom_components.tuya_local_ble import button
    from custom_components.tuya_local_ble.raykube import get_raykube_config

    async def scenario(hass):
        device, entity, fake = await make_lock(hass)

        async def unreachable(code, data, wait_for_response=True):
            raise protocol.BleakNotFoundError()

        device._send_packet = unreachable
        with pytest.raises(HomeAssistantError) as err:
            await entity.async_lock()
        assert err.value.translation_key == "lock_unreachable"
        assert "Bleak" not in str(err.value)

        async def broken(code, data, wait_for_response=True):
            raise ValueError("unexpected frame")

        device._send_packet = broken
        with pytest.raises(HomeAssistantError) as err:
            await entity.async_lock()
        assert err.value.translation_key == "command_failed"

        config = get_raykube_config(device)
        refresh = button.TuyaBLERaykubeRefreshButton(
            hass, entity.coordinator, device, get_device_product_info(device), config
        )

        async def silent_update():
            await asyncio.sleep(10)

        device.update = silent_update
        with patch.object(button, "REFRESH_DEADLINE", 0.1):
            with pytest.raises(HomeAssistantError) as err:
                await refresh.async_press()
        assert err.value.translation_key == "lock_no_response"

    run(scenario)
