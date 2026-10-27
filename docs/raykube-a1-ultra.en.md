# Raykube A1 Ultra in Home Assistant (local, over BLE)

🇵🇱 Wersja polska: [raykube-a1-ultra.md](raykube-a1-ultra.md)

This fork of [ShonP40/Tuya-BLE](https://github.com/ShonP40/Tuya-BLE) adds the full set of settings of
Raykube locks (`jtmspro`, `hc7n0urm` and `rlyxv7pe`) to Home Assistant.

## Entities

| HA entity (EN / PL name) | Function | DP | Type | Confidence |
|---|---|---|---|---|
| lock: Lock Control / Zamek | unlock / lock; state from DP47 (`false` = locked) | 71 (unlock), 46 (lock), 47 (state) | raw / bool | confirmed on hardware (upstream); DP47 state confirmed on `hc7n0urm` |
| select: Lock Volume / Głośność zamka | volume: `hc7n0urm` mute / normal, `rlyxv7pe` mute / low / normal / high | 31 | enum | Tuya cloud DP model |
| switch: Mute / Wyciszenie | mute / unmute | 31 | enum | same; unmuting restores the last level |
| switch: Auto Lock / Automatyczne zamykanie | lock automatically after unlocking | 33 | bool | Tuya cloud DP and BLE snapshot |
| number: Auto lock delay / Czas automatycznego zamknięcia | auto-lock delay (s), range 1–1800 | 36 | value | Tuya cloud DP and BLE snapshot |
| button: Calibrate / Kalibracja | lock calibration, at most once every 2 minutes (see [Command safety](#command-safety)) | 68 = `function1` | enum | confirmed: calibrating in the app reports DP68 = `function1` (`hc7n0urm`) |
| button: Refresh status / Odśwież stan | connects to the lock and reads its full state | – | – | – |
| sensor: Datapoints / Datapointy | every DP with its name, source and recent changes (attributes) | – | – | diagnostics, see [Diagnostics](#diagnostics) |
| sensor: Connection / Połączenie | BLE connection state, last error, last frames | – | – | diagnostics |

**Turning auto-lock off.** Use the *Auto Lock* switch. A delay of `0` does not turn auto-lock off: the lock
accepts 1–1800 s, so HA does not allow less than 1 s. While the switch is off the delay has no effect
and is kept for later.

Where the DP numbers come from:
- the `hc7n0urm` DP list from the Tuya cloud ([make-all/tuya-local#4098](https://github.com/make-all/tuya-local/issues/4098)),
- the tuya-local profile [`raykube_a1promax_lock.yaml`](https://github.com/make-all/tuya-local/blob/main/custom_components/tuya_local/devices/raykube_a1promax_lock.yaml) (DP68: `function1` = Recalibrate, `function2` = Unlock more, `function3` = Keep retracted, `function4` = Add force),
- the BLE status snapshot decoded in [ShonP40/Tuya-BLE#39](https://github.com/ShonP40/Tuya-BLE/pull/39) (DP 9, 11, 31, 33, 34, 36, 40, 47, 76, 77, 78).

Settings are written with the same V4 frame the Tuya app uses
(`00000000 01 <dp> <type> <len:2> <value>`, captured for the HL Knob-2 upstream).
Upstream sent the volume with the `raw` type, so the lock acknowledged the command but never applied it.
This fork sends it as `enum`.

## Installation

1. HACS → Integrations → ⋮ menu → *Custom repositories* → `https://github.com/jaroslaw-krolikowski/raykube-a1-ultra-integration`, category *Integration*.
   Or manually: copy `custom_components/tuya_local_ble` to `config/custom_components/`.
2. The fork uses the same domain (`tuya_local_ble`) as ShonP40/Tuya-BLE, so it **replaces** the original.
   If the original is installed, remove it from HACS (keep the integration entry and `devices.json`) and install the fork.
3. Fill in `config/tuya_local_ble/devices.json` (below) and restart HA.
4. The lock shows up as discovered in *Settings → Devices & services*. You can also add it manually:
   *Add integration → Raykube A1 Ultra (Tuya BLE)* and pick the lock from the list.

If adding it says that HA does not see any Tuya BLE device, Bluetooth in HA does not see the lock.
The usual causes:
- HA runs in a virtual machine (e.g. Proxmox) and the Bluetooth adapter is not passed through to it.
  Pass the USB adapter to the VM (*Hardware → Add → USB Device*) or use an ESPHome Bluetooth proxy.
- The lock is out of range of the adapter.
- The Tuya/Smart Life app is connected to the lock right now.

The Bluetooth integration in HA (*Settings → Devices & services → Bluetooth*) shows whether there is an
adapter or proxy. If the lock is listed but missing from `devices.json`, an error asks you to check the
MAC address in the file.

## `devices.json`

```json
{
  "XX:XX:XX:XX:XX:XX": {
    "address": "XX:XX:XX:XX:XX:XX",
    "uuid": "<uuid>",
    "local_key": "<local_key>",
    "device_id": "<device_id>",
    "category": "jtmspro",
    "product_id": "hc7n0urm",
    "device_name": "Raykube A1 Ultra",
    "product_model": "A1 Ultra",
    "product_name": "Smart lock",
    "ble_unlock_check": "<base64 from Tuya Cloud>",
    "raykube": {
      "beep_volume_options": ["mute", "normal"],
      "unmute_level": "normal"
    }
  }
}
```

The `raykube` block is optional. All keys:

| Key | Default | Meaning |
|---|---|---|
| `dps.beep_volume` | 31 | volume DP (select + mute) |
| `dps.automatic_lock` | 33 | auto-lock switch DP |
| `dps.auto_lock_time` | 36 | auto-lock delay DP |
| `dps.special_function` | 68 | calibration DP |
| `beep_volume_options` | `hc7n0urm`: `["mute","normal"]`, others: `["mute","low","normal","high"]` | volume levels in the order of the Tuya cloud model |
| `unmute_level` | `normal` | level after unmuting when the previous one is unknown |
| `calibrate_value` | 0 | DP68 value index sent to calibrate (`function1` = 0) |
| `auto_lock_time_min` / `auto_lock_time_max` | 1 / 1800 | range of the delay field (s) |
| `dp_codes` | `hc7n0urm`: from the Tuya model | DP names in diagnostics, e.g. `{"47": "lock_motor_state"}`; `tools/tuya_export.py` writes them |

`null` or `0` for a DP disables that entity, e.g. `"dps": {"special_function": null}`.

### Where to get the data

The easiest way is `tools/tuya_export.py` (Python 3.9+, no extra packages). It fetches every field it
needs from the Tuya Cloud, including `ble_unlock_check` and the full DP model, and writes a ready
`tuya_export/devices.json` with a `raykube` block matched to your lock.

1. Create an account on [platform.tuya.com](https://platform.tuya.com). Create *Cloud → Development → Create Cloud Project*
   in the data center of your app account (e.g. *Central Europe* for Europe).
2. In the project: *Service API* → make sure **IoT Core** is subscribed.
   *Devices → Link App Account* → scan the QR code with the Smart Life/Tuya app (Me → scan icon).
3. Copy the **Access ID** and **Access Secret** from *Overview*, then run:

```bash
export TUYA_ACCESS_ID=...  TUYA_ACCESS_SECRET=...  TUYA_REGION=eu
python3 tools/tuya_export.py
```

On Windows PowerShell use `$env:TUYA_ACCESS_ID="..."` (or pass `--access-id` / `--access-secret`).

The script prints the DP list of the lock (number, code, type, range, current value). Copy
`tuya_export/devices.json` to `config/tuya_local_ble/devices.json`. The files in `tuya_export/` contain
keys, which is why they are in `.gitignore`.

Manually, without the script:

- `local_key`, `uuid`, `device_id`, `product_id`, MAC: `python -m tinytuya wizard`
  ([TinyTuya](https://github.com/jasonacox/tinytuya)). The generated `devices.json` also has a
  `mapping` section with the DP list. **Check the `beep_volume` range there.** If it is e.g. `["mute","normal"]`,
  put it in `beep_volume_options`, because the enum indexes must match.
- `ble_unlock_check`: Tuya IoT Platform → Cloud → API Explorer → *Device Management → Get device status*,
  code `ble_unlock_check`. Without it locking works but unlocking does not.
- The app sometimes shows the MAC "backwards". If the lock is not discovered, reverse the byte order.

## "Raykube Lock" card

The integration ships its own dashboard card. HA loads it by itself, without HACS frontend or adding
resources. The integration cannot change the standard HA lock dialog (with the big switch), so this card
replaces it.

- **Only the button** on the right locks or unlocks. It shows what it will do: **Unlock** when locked,
  **Lock** when unlocked. A spinner runs until the lock confirms.
  - **Locking is always possible**: while an unlock is still on its way the button turns into **Lock**
    and drops that unlock.
  - When the lock does not confirm a command, the card shows the state the lock reported before
    with an *unconfirmed* warning.
  - **Unlocking asks for confirmation.** The first tap turns the button into a red **Confirm**; the door
    unlocks only on a second tap within a few seconds. Locking works right away.
    `confirm_unlock: false` turns the confirmation off.
  - When the state is unknown (e.g. right after an HA restart) the button always **locks**, never unlocks.
- **A tap on the rest of the tile**, a long press or the chevron opens the details panel. It never changes
  the lock:
  - **Lock** and **Unlock** buttons (unlocking with confirmation too). The one that changes the current
    state is highlighted;
  - the state and the time of the last change with where it came from: *at the lock* (thumb turn, key,
    app, auto-lock), *from Home Assistant* or *automation*;
  - battery, auto-lock and its delay, arming mode, optionally signal strength;
  - settings: arming mode, auto-lock, delay, mute, refresh status, calibration (with confirmation and a
    warning, at most once every 2 minutes);
  - events from the last 48 h.
- Refresh, calibration and errors show a Home Assistant toast. An error is a short message with the
  error code on the last line, e.g. `(error code: lock_unreachable)`. Technical details are in the HA log.
- The battery in the panel is coloured: high green, medium amber, low and empty red.

Adding it: *Edit dashboard → Add card →* search for **Raykube Lock**. Or in YAML:

```yaml
type: custom:raykube-lock-card
entity: lock.raykube_a1_ultra_d9f494_lock
name: Front door                        # optional
arming_entity: input_boolean.lock_armed # optional, arming mode helper
confirm_unlock: true                    # optional: false = unlock without confirmation
```

The card follows the language of Home Assistant (Polish or English, English for other languages).
Its look follows shadcn/ui and the icons are [Lucide](https://lucide.dev), built into the card.
It adapts to the light and dark HA themes.

The card finds the other entities of the lock (battery, auto-lock, mute, buttons) by itself. Each of them
can also be set by hand: `battery_entity`, `auto_lock_entity`, `auto_lock_time_entity`, `mute_entity`,
`refresh_entity`, `signal_entity`.

Settings the lock has not reported yet are shown as *Unknown* (dashed switch, empty delay field).
The **Refresh** button reads them from the lock.

After updating the integration, reload the page or the HA app to load the new card version.

### "Raykube Lock Chip" badge (e.g. on a floor plan)

A small badge with the lock icon, name and state (green: locked, orange: unlocked, blue: in progress,
grey: unknown). A tap opens the same details panel as the card. The badge itself never locks or
unlocks; the buttons in the panel do (unlocking with confirmation).

On an interactive floor plan (*Picture elements* card / `picture-elements`):

```yaml
type: picture-elements
image: /local/floor-plan.png
elements:
  - type: custom:raykube-lock-chip
    entity: lock.raykube_a1_ultra_d9f494_lock
    name: Door                # optional
    style:
      left: 38%               # position of the badge centre on the image
      top: 92%
```

It also works as a regular small card: *Add card →* **Raykube Lock Chip**.

## Arming mode (notification in Home Assistant)

The lock has no arming mode of its own (checked against the full `hc7n0urm` DP model), so arming mode
lives in Home Assistant. The lock is only a sensor here: the automation never changes the lock state
or its settings.

While arming mode is on and the lock goes from *locked* to *unlocked* without a command from HA (someone
turned the thumb turn, used a key or unlocked from the Tuya app), HA sends a notification. Unlocking from
HA (dashboard, automation, voice assistant) does not notify. HA tells them apart by the context of the
state change: a change reported by the lock itself has no user or automation attached.

> **Required: a fast connection mode.** The lock sleeps between commands. In the default *Read every
> 5 minutes* mode HA learns about a manual unlock up to about 5 minutes late. For notifications choose
> *Permanent connection (24/7)* in step 1, or *On advertisement change* if your lock signals changes in
> its advertisements.

### Setup

1. **Choose the connection mode.**
   *Settings → Devices & services → Raykube A1 Ultra (Tuya BLE)* → **⋮** menu next to the lock (or the cog icon)
   → **Options** / **Configure** → **Connection mode** → **Submit**. The integration reloads by itself.

   | Mode | A manual unlock shows up after | Lock battery |
   |---|---|---|
   | *Read every 5 minutes* (default) | up to ~5 min | medium: a connection about every 5 min |
   | *On advertisement change* (experimental) | a few seconds, **if** the lock changes its advertisement | lowest: connects only after a change, plus every 30 min |
   | *Permanent connection (24/7)* | a few seconds | highest: the lock's radio stays active |

   - Whether your lock changes its advertisement when turned is checked with the test in
     [Does the lock signal changes in its advertisements](#does-the-lock-signal-changes-in-its-advertisements).
   - With *Permanent connection*, keep an eye on the battery entity in the first weeks. It works best with
     an ESPHome Bluetooth proxy near the door; with poor range the connection drops.
   - The Tuya/Smart Life app cannot connect to the lock while HA holds the connection. Choose another
     mode while you use the app.
2. **Install the Home Assistant app on your phone** and sign in to your HA.
   The phone shows up as a device of the *Mobile App* integration and HA gets an action
   `notify.mobile_app_<phone_name>`. Find the full name in *Developer tools → Actions* by typing
   `notify.mobile_app`.
   - **iPhone:**
     - allow notifications on first launch;
     - for the alarm to break through silent mode and Focus, turn on *iOS Settings → Home Assistant →
       Notifications → **Critical Alerts***.
   - **Android:**
     - allow notifications (Android 13+ asks on first launch);
     - in *Android Settings → Apps → Home Assistant → Battery* choose **Unrestricted**, so the system
       does not put the app to sleep;
     - the `alarm_stream` channel in the example below plays an alarm sound even on a silenced phone.
3. **Send a test notification.** *Developer tools → Actions* → `notify.mobile_app_<phone_name>`
   → YAML mode → paste the example for your phone from step 6 → **Perform action**. If nothing arrives,
   go back to step 2.
4. **Create a helper:** *Settings → Devices & services → Helpers → Create helper → Toggle*,
   e.g. "Lock armed" (`input_boolean.lock_armed`). This is the arming mode switch.
   You can add it to the *Raykube Lock* card (`arming_entity`), to a dashboard, or turn it on from an automation.
5. **Import the blueprint:** *Settings → Automations & scenes → Blueprints → Import blueprint* and paste
   `https://github.com/jaroslaw-krolikowski/raykube-a1-ultra-integration/blob/master/blueprints/automation/a1ultra/lock_arming_alarm.yaml`.
   You can also copy the file to `config/blueprints/automation/a1ultra/`.
6. **Create an automation from the blueprint:** pick the lock and the helper. In the **Notification** field
   switch to YAML mode (**⋮ → Edit in YAML**) and paste the action for your phone. Replace
   `mobile_app_your_phone` with the name from step 2. Tapping the notification opens the HA dashboard;
   change `/lovelace/0` to your own path if needed.

   **Android** (alarm sound even on a silenced phone):
   ```yaml
   - action: notify.mobile_app_your_phone
     data:
       title: "Lock unlocked by hand!"
       message: "Arming mode: someone turned the lock."
       data:
         ttl: 0
         priority: high
         channel: alarm_stream
         tag: lock-arming
         clickAction: /lovelace/0
   ```

   **iPhone** (critical alert, breaks through silent mode):
   ```yaml
   - action: notify.mobile_app_your_phone
     data:
       title: "Lock unlocked by hand!"
       message: "Arming mode: someone turned the lock."
       data:
         push:
           sound:
             name: default
             critical: 1
             volume: 1.0
         url: /lovelace/0
   ```

   Several phones: paste several actions one below the other, or use a `notify` group.
7. **Check that it works:**
   - turn the helper on and turn the lock's thumb turn by hand. The notification should arrive within a
     few seconds;
   - unlock from HA. There should be no notification;
   - turn the helper off and turn the thumb turn. There should be no notification either.

   If the notification does not arrive:
   - check *Settings → Automations & scenes* → the automation → **⋮ → Traces** to see whether it ran.
     If it did not, HA never got the state change: check step 1 and the Bluetooth range.
   - If the automation ran, the problem is on the phone side. Check steps 2 and 3.

## Command safety

Rules added after the incident of 17.10.2026. That day commands waited in a queue for minutes,
HA showed "locked" although the bolt had not moved, and calibrations ran with a delay.

- **A command never runs late.** If it does not reach the lock within 20 s (lock: 45 s), it is dropped
  and HA shows an error. Nothing waits in a queue to run minutes later.
- **One command at a time.** Unlock and calibration are refused while another command is on its way.
- **30 s before the next unlock.** After any command (lock, unlock, calibration) the next unlock and
  calibration are blocked for 30 s. The card button counts down and the entity has the attribute
  `unlock_blocked_until`. So a second unlock right after locking or unlocking cannot happen by accident.
- **Locking is always possible.** Lock drops an unlock or calibration that has not reached the lock yet.
  Neither a pending command nor the calibration cooldown blocks it.
- **State only from the lock.** After a command the entity shows *Locking…* / *Unlocking…*. It shows
  *Locked* or *Unlocked* only once the lock reports it. Without a report within 45 s it goes back to the
  last state the lock reported (or *Unknown*). The attribute `command_confirmed: false` then means that
  the lock did not confirm the last command (`last_command`).
- **Calibration once every 2 minutes.**
  - The *Calibrate* button and the card (two taps and a warning; the `tuya_local_ble.calibrate`
    action on the lock entity) send one calibration.
  - Further presses within 2 minutes or during another command are refused, not queued.

  Calibration moves the bolt and stores its end positions; the lock may end up locked. A calibration
  in the wrong position reverses locking and unlocking, and then auto-lock *unlocks* the door.
  Start it only at the door, then check both directions on site.

## Diagnostics

The device page (*Settings → Devices & services → Raykube A1 Ultra (Tuya BLE) → the lock*) has two sensors in its
*Diagnostic* section and a **Download diagnostics** button in the **⋮** menu.

### "Connection" sensor

The state of the Bluetooth connection to the lock:

| State | Meaning |
|---|---|
| *Connected* | HA has an active connection to the lock |
| *Disconnected* | no connection. Normal for a battery lock between commands |
| *Connecting* | HA is trying to connect; the *Connection attempts* attribute goes up |
| *Error* | the last attempt failed; the reason is in the *Last error* attribute |

Attributes: *Connection mode*, *Last connected*, *Last disconnected*, *Last error* and its time,
*Connection attempts*, *Failed connections*, *Last frame received / sent* (time and type,
e.g. `FUN_RECEIVE_DP_V4`), *Last report from the device*, *Last advertisement change*,
*Advertisement changes* and RSSI.

#### Does the lock signal changes in its advertisements

The lock keeps broadcasting a short Bluetooth packet, even while asleep. *Last advertisement change* and
*Advertisement changes* tell when and how often the content of that packet changed (signal strength
alone does not count). Test it standing at the door:

1. Note *Advertisement changes* and wait a few minutes without touching the lock. If the number goes up
   by itself, the lock changes its advertisement for no reason and *On advertisement change* will not help.
2. Turn the thumb turn by hand. If *Last advertisement change* shows the current time within a few
   seconds and the number goes up, the lock signals changes: choose *On advertisement change*.
3. Repeat 2–3 times to rule out a coincidence.

The full content of the last packet is in the *Download diagnostics* file (`advertisement_data`).

Typical *Last error* values:
- `device not found, not in range or poor RSSI`: the lock is out of range of the adapter or proxy;
- `pairing request failed`, `connected but not paired`: the lock rejects pairing (check `local_key` in
  `devices.json`, or whether the Tuya app is connected);
- `timeout waiting for the response to …`: connected, but the lock does not answer.

### "Datapoints" sensor

- **State**: how many DPs the **lock itself** has reported. Values set or assumed by HA (e.g. after a
  command) do not count. If the number does not go up after **Refresh status**, the lock is not answering.
- **`dp_<number>_<code>` attributes**, e.g. `dp_47_lock_motor_state: false` (locked),
  `dp_31_beep_volume: normal`, `dp_36_auto_lock_time: 30`. Enums are shown by name. DPs without a code
  in the Tuya model show only the number (`dp_11`). DPs with keys and unlock codes are never shown.
- **Not reported by the lock**: DPs whose current value comes from HA (a command, a setting waiting for
  confirmation).
- **Last report**: when the lock last sent anything.
- **Recent changes**: the last 15 value changes, e.g.
  `2026-10-16 21:24:59 dp_47_lock_motor_state: true → false (device)`. Source `device` is a report from
  the lock, `home_assistant` a value set by HA.

### Download diagnostics

*Device page → ⋮ → Download diagnostics* saves a JSON file with all of the above: device versions,
connection state, every DP (name, type, value, source, time) and the last 50 changes.
`local_key`, `uuid`, `device_id`, `ble_unlock_check` and the values of sensitive DPs are masked, and only
the last 3 bytes of the MAC address are kept. The file is safe to attach to a bug report.

### Checking the real state of the lock remotely

1. Press **Refresh status** (or **Refresh** in the card).
2. After 15–30 s check the *Connection* sensor: it should be *Connected*, or *Disconnected* with a fresh
   *Last connected*. *Error* means HA could not talk to the lock; the reason is in *Last error*.
3. In the *Datapoints* sensor check that *Last report* is fresh and look at `dp_47_lock_motor_state`:
   `false` means locked, `true` unlocked.

The debug log has every frame: *Raykube A1 Ultra (Tuya BLE) → ⋮ → Enable debug logging*.
Look for lines like `Received FD50 V4 datapoint update, id: 47, …, value: False`.

## DP change history

```bash
python3 tools/tuya_export.py --logs 7
```

Prints the DP report history from the Tuya cloud (kept for about 7 days) and, at the end, the settings
(`rw`) whose value changed. The history only covers DPs declared in the Tuya model. The approach comes
from `Cloud.getdevicelog` in [TinyTuya](https://github.com/jasonacox/tinytuya). Locally the same is
visible in the **Datapoints** sensor after pressing **Refresh status**.

Any DP can be written from HA with the `tuya_local_ble.set_datapoint` action:

```yaml
action: tuya_local_ble.set_datapoint
data:
  device_id: <HA device id>
  dp_id: 78
  type: bool
  value: "true"
```

The other DP68 functions are available through the same action: `type: enum`, `value: 1` (Unlock more),
`2` (Keep retracted), `3` (Add force).

## Example automations

```yaml
# Lock and arm when everyone has left
- alias: Lock - arm when leaving
  triggers:
    - trigger: state
      entity_id: zone.home
      to: "0"
  actions:
    - action: lock.lock
      target: {entity_id: lock.your_lock}
    - action: input_boolean.turn_on
      target: {entity_id: input_boolean.lock_armed}

# Disarm when someone comes home
- alias: Lock - disarm when coming home
  triggers:
    - trigger: numeric_state
      entity_id: zone.home
      above: 0
  actions:
    - action: input_boolean.turn_off
      target: {entity_id: input_boolean.lock_armed}

# Quiet at night
- alias: Lock - mute at night
  triggers:
    - trigger: time
      at: "22:00:00"
  actions:
    - action: switch.turn_on
      target: {entity_id: switch.your_lock_mute}
```

Replace the entity ids (`lock.your_lock` etc.) with your own from the device page in HA.

## Limitations

- After an HA restart (including an integration update) the lock settings (auto-lock, delay, mute,
  volume) show their last known values. Until the lock confirms them they are listed under *Not reported
  by the lock* in the *Datapoints* sensor. Restored values are never sent to the lock.
- The lock state (locked / unlocked) is not restored, because it may have changed during the restart.
  HA reads it from the lock at startup and, if that fails, retries about 20 s later and then every
  2 minutes, up to 3 times.
- The battery lock sleeps between commands. HA connects on demand, so every change takes a few seconds.
  Settings are refreshed on every connection (snapshot), with **Refresh status**, or permanently with
  the *Permanent connection (24/7)* connection mode (an ESPHome BLE proxy is recommended then).
- The Tuya/Smart Life app and HA cannot be connected to the lock at the same time.
- After a lock/unlock command HA shows *Locking…* / *Unlocking…* until the lock reports its state
  (HA queries it about 12 s later). See [Command safety](#command-safety).
- On some units with firmware 5.6 `ble_unlock_check` changes after every unlock from the app, and
  unlocking from HA stops working. See [ShonP40/Tuya-BLE#17](https://github.com/ShonP40/Tuya-BLE/issues/17).
- The *Lock Direction* entity (DP48) comes from upstream. In the tuya-local profile the direction of these
  locks is DP78 (`special_control`). To change the direction, use `set_datapoint` with `dp_id: 78`,
  `type: bool`.
