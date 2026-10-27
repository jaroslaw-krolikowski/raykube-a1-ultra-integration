# Raykube A1 Ultra w Home Assistant (lokalnie po BLE)

🇬🇧 English version: [raykube-a1-ultra.en.md](raykube-a1-ultra.en.md)

Ten fork [ShonP40/Tuya-BLE](https://github.com/ShonP40/Tuya-BLE) dodaje do zamków Raykube
(`jtmspro`, `hc7n0urm` i `rlyxv7pe`) pełny zestaw ustawień w Home Assistant.

## Encje

| Encja HA (nazwa PL / EN) | Funkcja | DP | Typ | Pewność |
|---|---|---|---|---|
| lock: Zamek / Lock Control | otwieranie / zamykanie; stan z DP47 (`false` = zamknięty) | 71 (otwarcie), 46 (zamknięcie), 47 (stan) | raw / bool | potwierdzone fizycznie (upstream); stan DP47 potwierdzony na `hc7n0urm` |
| select: Głośność zamka / Lock Volume | głośność: `hc7n0urm` mute / normal, `rlyxv7pe` mute / low / normal / high | 31 | enum | model DP z chmury Tuya |
| switch: Wyciszenie / Mute | wycisz / odcisz | 31 | enum | j.w. Odciszenie przywraca ostatni poziom |
| switch: Automatyczne zamykanie / Auto Lock | auto-zamykanie po otwarciu | 33 | bool | DP z chmury Tuya i snapshotu BLE |
| number: Czas automatycznego zamknięcia / Auto lock delay | opóźnienie auto-zamknięcia (s), zakres 1–1800 | 36 | value | DP z chmury Tuya i snapshotu BLE |
| button: Kalibracja / Calibrate | kalibracja zamka, najwyżej raz na 2 minuty (zob. [Bezpieczeństwo komend](#bezpieczeństwo-komend)) | 68 = `function1` | enum | potwierdzone: kalibracja w aplikacji raportuje DP68 = `function1` (`hc7n0urm`) |
| button: Odśwież stan / Refresh status | łączy się z zamkiem i pobiera pełny stan | – | – | – |
| sensor: Datapointy / Datapoints | wszystkie DP z nazwami, źródłem i ostatnimi zmianami (atrybuty) | – | – | diagnostyka, zob. [Diagnostyka](#diagnostyka) |
| sensor: Połączenie / Connection | stan połączenia BLE, ostatni błąd, ostatnie ramki | – | – | diagnostyka |

**Wyłączenie auto-zamykania.** Do tego służy przełącznik *Automatyczne zamykanie*. Czas `0` nie wyłącza
auto-zamykania: zamek przyjmuje 1–1800 s, więc HA nie pozwala wpisać mniej niż 1 s. Gdy przełącznik
jest wyłączony, ustawiony czas nie ma znaczenia i zostaje zapamiętany na później.

Skąd te numery DP:
- lista DP `hc7n0urm` z chmury Tuya ([make-all/tuya-local#4098](https://github.com/make-all/tuya-local/issues/4098)),
- profil [`raykube_a1promax_lock.yaml`](https://github.com/make-all/tuya-local/blob/main/custom_components/tuya_local/devices/raykube_a1promax_lock.yaml) z tuya-local (DP68: `function1` = Recalibrate, `function2` = Unlock more, `function3` = Keep retracted, `function4` = Add force),
- snapshot stanu po BLE zdekodowany w [ShonP40/Tuya-BLE#39](https://github.com/ShonP40/Tuya-BLE/pull/39) (DP 9, 11, 31, 33, 34, 36, 40, 47, 76, 77, 78).

Kod zapisuje ustawienia tą samą ramką V4, której używa aplikacja Tuya
(`00000000 01 <dp> <typ> <len:2> <wartość>`, przechwyconą dla HL Knob-2 w upstreamie).
Upstream wysyłał głośność z typem `raw`, przez co zamek potwierdzał komendę, ale jej nie odsyłał.
Ten fork wysyła ją jako `enum`.

## Instalacja

1. HACS → Integrations → menu ⋮ → *Custom repositories* → `https://github.com/jaroslaw-krolikowski/raykube-a1-ultra-integration`, kategoria *Integration*.
   Albo ręcznie: skopiuj `custom_components/tuya_local_ble` do `config/custom_components/`.
2. Fork ma tę samą domenę (`tuya_local_ble`) co ShonP40/Tuya-BLE, więc **zastępuje** oryginał.
   Jeśli oryginał jest zainstalowany, usuń go z HACS (zostaw wpis integracji i `devices.json`) i zainstaluj fork.
3. Uzupełnij `config/tuya_local_ble/devices.json` (niżej) i zrestartuj HA.
4. Zamek pojawi się jako wykryty w *Ustawienia → Urządzenia i usługi*. Możesz go też dodać ręcznie:
   *Dodaj integrację → Raykube A1 Ultra (Tuya BLE)* i wybrać zamek z listy.

Jeśli przy dodawaniu pojawia się komunikat, że HA nie widzi żadnego urządzenia Tuya BLE, to Bluetooth
w HA nie widzi zamka. Najczęstsze przyczyny:
- HA działa w maszynie wirtualnej (np. Proxmox), a adapter Bluetooth nie jest do niej przekazany.
  Przekaż adapter USB do VM (*Hardware → Add → USB Device*) albo użyj ESPHome Bluetooth proxy.
- Zamek jest poza zasięgiem adaptera.
- Aplikacja Tuya/Smart Life jest w tej chwili połączona z zamkiem.

Integracja Bluetooth w HA (*Ustawienia → Urządzenia i usługi → Bluetooth*) pokazuje, czy jest jakiś adapter
lub proxy. Jeśli zamek jest na liście, ale nie ma go w `devices.json`, pojawi się błąd z prośbą o
sprawdzenie adresu MAC w pliku.

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
    "ble_unlock_check": "<base64 z Tuya Cloud>",
    "raykube": {
      "beep_volume_options": ["mute", "normal"],
      "unmute_level": "normal"
    }
  }
}
```

Blok `raykube` jest opcjonalny. Wszystkie klucze:

| Klucz | Domyślnie | Znaczenie |
|---|---|---|
| `dps.beep_volume` | 31 | DP głośności (select + wyciszenie) |
| `dps.automatic_lock` | 33 | DP przełącznika auto-zamykania |
| `dps.auto_lock_time` | 36 | DP czasu auto-zamykania |
| `dps.special_function` | 68 | DP kalibracji |
| `beep_volume_options` | `hc7n0urm`: `["mute","normal"]`, inne: `["mute","low","normal","high"]` | poziomy głośności w kolejności z chmury Tuya |
| `unmute_level` | `normal` | poziom po odciszeniu, gdy nie znamy poprzedniego |
| `calibrate_value` | 0 | indeks wartości DP68 wysyłany przy kalibracji (`function1` = 0) |
| `auto_lock_time_min` / `auto_lock_time_max` | 1 / 1800 | zakres pola czasu (s) |
| `dp_codes` | `hc7n0urm`: z modelu Tuya | nazwy DP w diagnostyce, np. `{"47": "lock_motor_state"}`; `tools/tuya_export.py` zapisuje je sam |

`null` albo `0` przy DP wyłącza daną encję, np. `"dps": {"special_function": null}`.

### Skąd wziąć dane

Najprościej skryptem `tools/tuya_export.py` (Python 3.9+, bez dodatkowych pakietów). Pobiera z Tuya Cloud
wszystkie potrzebne pola, w tym `ble_unlock_check` i pełny model DP, i zapisuje gotowy
`tuya_export/devices.json` razem z blokiem `raykube` dopasowanym do Twojego zamka.

1. Załóż konto na [platform.tuya.com](https://platform.tuya.com). Utwórz *Cloud → Development → Create Cloud Project*,
   z data center *Central Europe* dla kont z Polski.
2. W projekcie: *Service API* → upewnij się, że jest subskrybowane **IoT Core**.
   *Devices → Link App Account* → zeskanuj kod QR aplikacją Smart Life/Tuya (Ja → ikona skanowania).
3. Z zakładki *Overview* skopiuj **Access ID** i **Access Secret**, potem uruchom:

```bash
export TUYA_ACCESS_ID=...  TUYA_ACCESS_SECRET=...  TUYA_REGION=eu
python3 tools/tuya_export.py
```

Skrypt wypisze listę DP zamka (numer, kod, typ, zakres, aktualna wartość). Plik `tuya_export/devices.json` skopiuj do
`config/tuya_local_ble/devices.json`. Pliki w `tuya_export/` zawierają klucze, dlatego są w `.gitignore`.

Ręcznie, bez skryptu:

- `local_key`, `uuid`, `device_id`, `product_id`, MAC: `python -m tinytuya wizard`
  ([TinyTuya](https://github.com/jasonacox/tinytuya)). W wygenerowanym `devices.json` jest też
  sekcja `mapping` z listą DP. **Sprawdź w niej zakres `beep_volume`.** Jeśli to np. `["mute","normal"]`,
  wpisz go w `beep_volume_options`, bo indeksy enum muszą się zgadzać.
- `ble_unlock_check`: Tuya IoT Platform → Cloud → API Explorer → *Device Management → Get device status*,
  kod `ble_unlock_check`. Bez niego zamykanie działa, ale otwieranie nie.
- MAC bywa zapisany w aplikacji „od tyłu”. Jeśli zamek nie jest wykrywany, odwróć kolejność bajtów.

## Karta „Raykube Lock”

Integracja instaluje własną kartę dashboardu. HA ładuje ją sam, bez HACS frontend i bez dodawania zasobów.
Standardowego okna zamka w HA (z dużym przełącznikiem) integracja zmienić nie może, więc ta karta je zastępuje.

- **Tylko przycisk** po prawej zamyka albo otwiera zamek. Pokazuje, co zrobi: **Otwórz** przy zamkniętym,
  **Zamknij** przy otwartym. Do czasu potwierdzenia przez zamek kręci się wskaźnik.
  - **Zamknąć można zawsze**: gdy otwarcie jest jeszcze w drodze, przycisk zmienia się na **Zamknij**
    i anuluje to otwarcie.
  - Gdy zamek nie potwierdzi komendy, karta pokazuje stan zgłoszony przez zamek wcześniej
    i ostrzeżenie *niepotwierdzone*.
  - **Otwarcie wymaga potwierdzenia.** Pierwsze stuknięcie zmienia przycisk na czerwony **Potwierdź**,
    drzwi otwiera dopiero drugie stuknięcie w ciągu kilku sekund. Zamykanie działa od razu.
    Potwierdzenie wyłącza `confirm_unlock: false`.
  - Gdy stan jest nieznany (np. tuż po restarcie HA), przycisk zawsze **zamyka**, nigdy nie otwiera.
- **Stuknięcie w resztę kafelka**, przytrzymanie albo strzałka otwiera panel ze szczegółami. Nie zmienia
  stanu zamka:
  - przyciski **Zamknij** i **Otwórz** (otwarcie też z potwierdzeniem). Wyróżniony jest ten,
    który zmienia aktualny stan;
  - stan i czas ostatniej zmiany z informacją, skąd przyszła: *na zamku* (gałka, klucz, aplikacja,
    auto-zamknięcie), *z Home Assistant* albo *automatyzacja*;
  - bateria, auto-zamykanie i jego czas, tryb uzbrojenia, opcjonalnie siła sygnału;
  - ustawienia: tryb uzbrojenia, auto-zamykanie, czas, wyciszenie, odświeżenie stanu, kalibracja
    (z potwierdzeniem i ostrzeżeniem, najwyżej raz na 2 minuty);
  - ostatnie zdarzenia z 48 h.
- Odświeżenie, kalibracja i błędy pokazują powiadomienie (toast) Home Assistant. Błąd to krótki opis,
  a w ostatniej linii kod błędu, np. `(kod błędu: lock_unreachable)`. Szczegóły techniczne są w logu HA.
- Bateria w panelu ma kolor: wysoki zielony, średni pomarańczowy, niski i wyczerpana czerwony.

Dodanie: *Edytuj dashboard → Dodaj kartę →* wyszukaj **Raykube Lock**. Albo w YAML:

```yaml
type: custom:raykube-lock-card
entity: lock.raykube_a1_ultra_d9f494_zamek
name: Drzwi wejściowe                        # opcjonalnie
arming_entity: input_boolean.zamek_uzbrojony # opcjonalnie, pomocnik trybu uzbrojenia
confirm_unlock: true                         # opcjonalnie: false = otwarcie bez potwierdzenia
```

Wygląd jest wzorowany na shadcn/ui, a ikony to [Lucide](https://lucide.dev) wbudowane w kartę.
Karta dopasowuje się do jasnego i ciemnego motywu HA.

Pozostałe encje zamka (bateria, auto-zamykanie, wyciszenie, przyciski) karta znajduje sama. Każdą można też
wskazać ręcznie: `battery_entity`, `auto_lock_entity`, `auto_lock_time_entity`, `mute_entity`,
`refresh_entity`, `signal_entity`.

Ustawienia, których zamek jeszcze nie przesłał, karta pokazuje jako *Nieznany* (przerywany przełącznik,
puste pole czasu). Przycisk **Odśwież** pobiera je z zamka.

Po aktualizacji integracji odśwież stronę albo aplikację HA, żeby wczytać nową wersję karty.

### Plakietka „Raykube Lock Chip” (np. na rzut mieszkania)

Mała plakietka z ikoną, nazwą i stanem zamka (zielona: zamknięty, pomarańczowa: otwarty, niebieska:
w trakcie, szara: nieznany). Stuknięcie otwiera ten sam panel szczegółów co karta. Sama plakietka
nigdy nie zamyka ani nie otwiera zamka; robią to przyciski w panelu (otwarcie z potwierdzeniem).

Na interaktywnym rzucie (karta *Obraz z elementami* / `picture-elements`):

```yaml
type: picture-elements
image: /local/rzut.png
elements:
  - type: custom:raykube-lock-chip
    entity: lock.raykube_a1_ultra_d9f494_zamek
    name: Drzwi               # opcjonalnie
    style:
      left: 38%               # położenie środka plakietki na obrazie
      top: 92%
```

Można ją też dodać jako zwykłą małą kartę: *Dodaj kartę →* **Raykube Lock Chip**.

## Tryb uzbrojenia (powiadomienie w Home Assistant)

Zamek nie ma własnego trybu uzbrojenia (sprawdzone na pełnym modelu DP `hc7n0urm`), więc tryb uzbrojenia
działa w Home Assistant. Zamek jest w nim tylko czujnikiem. Automatyzacja nie zmienia stanu zamka
ani jego ustawień.

Gdy tryb jest włączony, a zamek zmieni stan z *zamknięty* na *otwarty* nie z polecenia HA (ktoś przekręcił
gałkę, użył klucza albo otworzył z aplikacji Tuya), HA wysyła powiadomienie. Otwarcie z HA (panel,
automatyzacja, asystent głosowy) powiadomienia nie wysyła. HA rozpoznaje to po kontekście zmiany stanu:
zmiana zgłoszona przez sam zamek nie ma przypisanego użytkownika ani automatyzacji.

> **Wymagane: szybki tryb połączenia.** Zamek śpi między komendami. W domyślnym trybie *Odczyt co 5 minut*
> HA dowiaduje się o ręcznym otwarciu z opóźnieniem do ok. 5 minut. Na powiadomienia wybierz w kroku 1
> tryb *Stałe połączenie (24/7)* albo, jeśli Twój zamek sygnalizuje zmiany w rozgłaszaniu,
> *Po zmianie rozgłaszania*.

### Konfiguracja

1. **Wybierz tryb połączenia.**
   *Ustawienia → Urządzenia i usługi → Raykube A1 Ultra (Tuya BLE)* → przy zamku menu **⋮** (albo ikona koła zębatego)
   → **Opcje** / **Konfiguruj** → **Tryb połączenia** → **Zatwierdź**. Integracja przeładuje się sama.

   | Tryb | Ręczne otwarcie widać po | Bateria zamka |
   |---|---|---|
   | *Odczyt co 5 minut* (domyślnie) | do ~5 min | średnio: połączenie mniej więcej co 5 min |
   | *Po zmianie rozgłaszania* (eksperymentalne) | kilka sekund, **jeśli** zamek zmienia rozgłaszanie | najmniej: łączy się tylko po zmianie, plus co 30 min |
   | *Stałe połączenie (24/7)* | kilka sekund | najwięcej: radio zamka stale aktywne |

   - Czy Twój zamek zmienia rozgłaszanie po przekręceniu, sprawdzisz testem z sekcji
     [Czy zamek sygnalizuje zmiany w rozgłaszaniu](#czy-zamek-sygnalizuje-zmiany-w-rozgłaszaniu).
   - Przy *Stałym połączeniu* sprawdzaj encję baterii w pierwszych tygodniach. Najlepiej działa z ESPHome
     Bluetooth proxy blisko drzwi; przy słabym zasięgu połączenie będzie się zrywać.
   - Aplikacja Tuya/Smart Life nie połączy się z zamkiem, dopóki HA trzyma połączenie.
     Na czas korzystania z aplikacji wybierz inny tryb.
2. **Zainstaluj aplikację Home Assistant na telefonie** i zaloguj się do swojego HA.
   Telefon pojawi się jako urządzenie integracji *Mobile App*, a w HA powstanie akcja
   `notify.mobile_app_<nazwa_telefonu>`. Pełną nazwę znajdziesz w *Narzędzia deweloperskie → Akcje*
   po wpisaniu `notify.mobile_app`.
   - **iPhone:**
     - przy pierwszym uruchomieniu zezwól na powiadomienia;
     - żeby alarm przebijał tryb cichy i Skupienie, włącz *Ustawienia iOS → Home Assistant →
       Powiadomienia → **Alerty krytyczne***.
   - **Android:**
     - zezwól na powiadomienia (Android 13+ pyta o to przy pierwszym uruchomieniu);
     - w *Ustawienia Androida → Aplikacje → Home Assistant → Bateria* wybierz **Bez ograniczeń**,
       żeby system nie usypiał aplikacji;
     - kanał `alarm_stream` z przykładu niżej gra dźwiękiem alarmu także przy wyciszonym telefonie.
3. **Wyślij powiadomienie testowe.** *Narzędzia deweloperskie → Akcje* → `notify.mobile_app_<nazwa_telefonu>`
   → tryb YAML → wklej przykład dla swojego telefonu z kroku 6 → **Wykonaj akcję**. Jeśli nic nie przyszło,
   wróć do kroku 2.
4. **Utwórz pomocnika:** *Ustawienia → Urządzenia i usługi → Pomocnicy → Utwórz pomocnika → Przełącznik*,
   np. „Zamek uzbrojony” (`input_boolean.zamek_uzbrojony`). To jest włącznik trybu uzbrojenia.
   Możesz go dodać do karty *Raykube Lock* (`arming_entity`), na dashboard albo włączać automatyzacją.
5. **Zaimportuj blueprint:** *Ustawienia → Automatyzacje i sceny → Blueprinty → Importuj blueprint* i wklej
   `https://github.com/jaroslaw-krolikowski/raykube-a1-ultra-integration/blob/master/blueprints/automation/a1ultra/lock_arming_alarm.yaml`.
   Możesz też skopiować plik do `config/blueprints/automation/a1ultra/`.
6. **Utwórz automatyzację z blueprintu:** wybierz zamek i pomocnika. W polu **Powiadomienie** przełącz
   się na tryb YAML (menu **⋮ → Edytuj w YAML**) i wklej akcję dla swojego telefonu.
   `mobile_app_twoj_telefon` zamień na nazwę z kroku 2. Po stuknięciu w powiadomienie otworzy się
   dashboard HA; ścieżkę `/lovelace/0` możesz zmienić na swoją.

   **Android** (dźwięk alarmu także przy wyciszonym telefonie):
   ```yaml
   - action: notify.mobile_app_twoj_telefon
     data:
       title: "Zamek otwarty ręcznie!"
       message: "Tryb uzbrojenia: ktoś przekręcił zamek."
       data:
         ttl: 0
         priority: high
         channel: alarm_stream
         tag: zamek-uzbrojenie
         clickAction: /lovelace/0
   ```

   **iPhone** (alert krytyczny, przebija tryb cichy):
   ```yaml
   - action: notify.mobile_app_twoj_telefon
     data:
       title: "Zamek otwarty ręcznie!"
       message: "Tryb uzbrojenia: ktoś przekręcił zamek."
       data:
         push:
           sound:
             name: default
             critical: 1
             volume: 1.0
         url: /lovelace/0
   ```

   Kilka telefonów: wklej kilka akcji jedna pod drugą albo użyj grupy `notify`.
7. **Sprawdź działanie:**
   - włącz pomocnika i przekręć gałkę zamka ręką. Powiadomienie powinno przyjść w ciągu kilku sekund;
   - otwórz zamek z HA. Powiadomienia być nie powinno;
   - wyłącz pomocnika i przekręć gałkę. Powiadomienia też być nie powinno.

   Jeśli powiadomienie nie przychodzi:
   - sprawdź w *Ustawienia → Automatyzacje i sceny* → automatyzacja → **⋮ → Ślady**, czy się uruchomiła.
     Jeśli nie, HA nie dostał zmiany stanu, więc sprawdź krok 1 i zasięg Bluetooth.
   - Jeśli automatyzacja się uruchomiła, problem jest po stronie telefonu. Sprawdź kroki 2 i 3.

## Bezpieczeństwo komend

Zasady wprowadzone po incydencie z 17.10.2026. Komendy czekały wtedy w kolejce kilka minut,
HA pokazał „zamknięte”, chociaż rygiel się nie ruszył, a kalibracje wykonały się z opóźnieniem.

- **Komenda nie wykona się później.** Jeśli nie dotrze do zamka w 20 s (zamknięcie: 45 s), jest
  anulowana i HA pokazuje błąd. Nic nie czeka w kolejce i nie wykonuje się po kilku minutach.
- **Jedna komenda naraz.** Otwarcie i kalibracja są odrzucane, dopóki poprzednia komenda jest w drodze.
- **30 s przerwy przed otwarciem.** Po każdej komendzie (zamknij, otwórz, kalibracja) kolejne otwarcie
  i kalibracja są zablokowane na 30 s. Przycisk w karcie odlicza czas, a encja ma atrybut
  `unlock_blocked_until`. Nie da się więc przypadkiem otworzyć drugi raz tuż po zamknięciu albo otwarciu.
- **Zamknąć można zawsze.** Zamknięcie anuluje otwarcie albo kalibrację, które jeszcze nie dotarły do zamka.
  Nie blokuje go ani trwająca komenda, ani blokada kalibracji.
- **Stan tylko z zamka.** Po komendzie encja pokazuje *Zamykanie…* / *Otwieranie…*. *Zamknięty* albo
  *Otwarty* pokaże dopiero wtedy, gdy zgłosi to zamek. Bez zgłoszenia w 45 s encja wraca do ostatniego
  stanu zgłoszonego przez zamek (albo *Nieznany*). Atrybut `command_confirmed: false` oznacza wtedy,
  że ostatniej komendy (`last_command`) zamek nie potwierdził.
- **Kalibracja raz na 2 minuty.**
  - Przycisk *Kalibracja* i karta (dwa stuknięcia i ostrzeżenie; usługa `tuya_local_ble.calibrate`
    z encją zamka) wysyłają jedną kalibrację.
  - Kolejne wciśnięcia w ciągu 2 minut albo w czasie innej komendy są odrzucane, a nie kolejkowane.

  Kalibracja porusza ryglem i zapamiętuje jego skrajne położenia; zamek może się na końcu zamknąć.
  Kalibracja w złym położeniu odwraca zamykanie i otwieranie. Wtedy auto-zamknięcie *otwiera* drzwi.
  Uruchamiaj ją tylko przy drzwiach, a potem sprawdź na miejscu oba kierunki.

## Diagnostyka

Na stronie urządzenia (*Ustawienia → Urządzenia i usługi → Raykube A1 Ultra (Tuya BLE) → zamek*) w sekcji
*Diagnostyka* są dwa sensory oraz przycisk **Pobierz diagnostykę** w menu **⋮**.

### Sensor „Połączenie”

Stan połączenia Bluetooth z zamkiem:

| Stan | Znaczenie |
|---|---|
| *Połączony* | HA ma aktywne połączenie z zamkiem |
| *Rozłączony* | brak połączenia. Przy zamku na baterie to normalne między komendami |
| *Łączenie* | HA właśnie próbuje się połączyć; atrybut *Próby połączenia* rośnie |
| *Błąd* | ostatnia próba się nie udała; przyczyna jest w atrybucie *Ostatni błąd* |

Atrybuty: *Tryb połączenia*, *Ostatnie połączenie*, *Ostatnie rozłączenie*, *Ostatni błąd* i jego czas,
*Próby połączenia*, *Nieudane połączenia*, *Ostatnia odebrana / wysłana ramka* (czas i typ,
np. `FUN_RECEIVE_DP_V4`), *Ostatni raport urządzenia*, *Ostatnia zmiana rozgłaszania*,
*Zmiany rozgłaszania* i RSSI.

#### Czy zamek sygnalizuje zmiany w rozgłaszaniu

Zamek co chwilę rozgłasza krótki pakiet Bluetooth, nawet gdy śpi. Atrybuty *Ostatnia zmiana rozgłaszania*
i *Zmiany rozgłaszania* mówią, kiedy i ile razy zmieniła się treść tego pakietu (sama siła sygnału się
nie liczy). Test, stojąc przy drzwiach:

1. Zapisz wartość *Zmiany rozgłaszania* i odczekaj kilka minut bez dotykania zamka. Jeśli liczba rośnie
   sama z siebie, zamek zmienia rozgłaszanie bez powodu i tryb *Po zmianie rozgłaszania* nic nie da.
2. Przekręć gałkę ręcznie. Jeśli w ciągu kilku sekund *Ostatnia zmiana rozgłaszania* pokaże bieżącą
   godzinę, a liczba wzrośnie, zamek sygnalizuje zmiany: wybierz tryb *Po zmianie rozgłaszania*.
3. Powtórz 2–3 razy, żeby wykluczyć przypadek.

Pełna treść ostatniego pakietu jest w pliku *Pobierz diagnostykę* (`advertisement_data`).

Typowe wartości *Ostatniego błędu*:
- `device not found, not in range or poor RSSI`: zamek poza zasięgiem adaptera albo proxy;
- `pairing request failed`, `connected but not paired`: zamek odrzuca parowanie (sprawdź `local_key`
  w `devices.json` albo czy aplikacja Tuya nie jest połączona);
- `timeout waiting for the response to …`: połączenie jest, ale zamek nie odpowiada.

### Sensor „Datapointy”

- **Stan**: ile DP przysłał **sam zamek**. Wartości ustawione albo założone przez HA (np. po komendzie)
  się nie liczą. Jeśli po **Odśwież stan** liczba nie rośnie, zamek nie odpowiada.
- **Atrybuty `dp_<numer>_<kod>`**, np. `dp_47_lock_motor_state: false` (zamknięty),
  `dp_31_beep_volume: normal`, `dp_36_auto_lock_time: 30`. Enumy są pokazane nazwami. DP bez kodu
  w modelu Tuya mają sam numer (`dp_11`). DP z kluczami i kodami otwierania nie są pokazywane.
- **Nie od zamka**: DP, których aktualna wartość pochodzi z HA (komenda, ustawienie czekające na potwierdzenie).
- **Ostatni raport**: kiedy zamek ostatnio cokolwiek przysłał.
- **Ostatnie zmiany**: 15 ostatnich zmian wartości, np.
  `2026-10-16 21:24:59 dp_47_lock_motor_state: true → false (device)`. Źródło `device` to raport zamka,
  `home_assistant` to wartość ustawiona przez HA.

### Pobierz diagnostykę

*Strona urządzenia → ⋮ → Pobierz diagnostykę* zapisuje plik JSON z całą powyższą zawartością:
wersje urządzenia, stan połączenia, wszystkie DP (nazwa, typ, wartość, źródło, czas) i ostatnie 50 zmian.
`local_key`, `uuid`, `device_id`, `ble_unlock_check` i wartości wrażliwych DP są zamaskowane,
a z adresu MAC zostają tylko ostatnie 3 bajty. Plik można bezpiecznie dołączyć do zgłoszenia problemu.

### Jak sprawdzić realny stan zamka zdalnie

1. Naciśnij **Odśwież stan** (albo **Odśwież** w karcie).
2. Po 15–30 s sprawdź sensor *Połączenie*: powinien być *Połączony* albo *Rozłączony* z świeżym
   *Ostatnim połączeniem*. *Błąd* oznacza, że HA nie dogadał się z zamkiem; przyczyna jest w *Ostatnim błędzie*.
3. W sensorze *Datapointy* sprawdź *Ostatni raport* (czy jest świeży) i `dp_47_lock_motor_state`:
   `false` oznacza zamknięty, `true` otwarty.

Szczegółowy zapis ramek daje log debug: *Raykube A1 Ultra (Tuya BLE) → ⋮ → Włącz rejestrowanie debugowania*.
Szukaj linii `Received FD50 V4 datapoint update, id: 47, …, value: False`.

## Historia zmian DP

```bash
python3 tools/tuya_export.py --logs 7
```

Wypisuje historię raportów DP z chmury Tuya (przechowywaną ok. 7 dni), a na końcu ustawienia (`rw`),
które zmieniały wartość. Historia obejmuje tylko DP zadeklarowane w modelu Tuya. Sposób zaczerpnięty
z `Cloud.getdevicelog` w [TinyTuya](https://github.com/jasonacox/tinytuya). Lokalnie to samo widać
w sensorze **Datapointy** po naciśnięciu **Odśwież stan**.

Dowolny DP można zapisać z HA usługą `tuya_local_ble.set_datapoint`:

```yaml
action: tuya_local_ble.set_datapoint
data:
  device_id: <id urządzenia z HA>
  dp_id: 78
  type: bool
  value: "true"
```

Tą samą usługą dostępne są pozostałe funkcje DP68: `type: enum`, `value: 1` (Unlock more),
`2` (Keep retracted), `3` (Add force).

## Przykładowe automatyzacje

```yaml
# Zamknięcie i uzbrojenie po wyjściu wszystkich z domu
- alias: Zamek - uzbrój po wyjściu
  triggers:
    - trigger: state
      entity_id: zone.home
      to: "0"
  actions:
    - action: lock.lock
      target: {entity_id: lock.twoj_zamek}
    - action: input_boolean.turn_on
      target: {entity_id: input_boolean.zamek_uzbrojony}

# Rozbrojenie po powrocie
- alias: Zamek - rozbrój po powrocie
  triggers:
    - trigger: numeric_state
      entity_id: zone.home
      above: 0
  actions:
    - action: input_boolean.turn_off
      target: {entity_id: input_boolean.zamek_uzbrojony}

# Cisza nocna
- alias: Zamek - wycisz na noc
  triggers:
    - trigger: time
      at: "22:00:00"
  actions:
    - action: switch.turn_on
      target: {entity_id: switch.twoj_zamek_wyciszenie}
```

Identyfikatory encji (`lock.twoj_zamek` itd.) podmień na swoje z ustawień urządzenia w HA.

## Ograniczenia

- Po restarcie HA (także po aktualizacji integracji) ustawienia zamka: auto-zamykanie, czas, wyciszenie
  i głośność pokazują ostatnie znane wartości. Do czasu potwierdzenia przez zamek są w sensorze *Datapointy*
  na liście *Nie od zamka*. Przywrócone wartości nie są wysyłane do zamka.
- Stan zamka (zamknięty / otwarty) nie jest przywracany, bo mógł się zmienić w czasie restartu.
  HA odczytuje go z zamka przy starcie, a jeśli się nie uda, ok. 20 s później ponawia odczyt
  co 2 minuty, maksymalnie 3 razy.
- Zamek na baterie śpi między komendami. HA łączy się na żądanie, więc każda zmiana trwa kilka sekund.
  Stan ustawień odświeża się przy każdym połączeniu (snapshot), przyciskiem **Odśwież stan**
  albo na stałe w trybie połączenia *Stałe połączenie (24/7)* (wtedy lepiej użyć ESPHome BLE proxy).
- Aplikacja Tuya/Smart Life i HA nie mogą być połączone z zamkiem jednocześnie.
- Po komendzie zamknij/otwórz HA pokazuje *Zamykanie…* / *Otwieranie…*, dopóki zamek nie zgłosi
  swojego stanu (ok. 12 s później HA sam go odpytuje). Szczegóły w [Bezpieczeństwo komend](#bezpieczeństwo-komend).
- Na części egzemplarzy z firmware 5.6 `ble_unlock_check` zmienia się po każdym otwarciu z aplikacji
  i otwieranie z HA przestaje działać. Zobacz [ShonP40/Tuya-BLE#17](https://github.com/ShonP40/Tuya-BLE/issues/17).
- Encja *Kierunek zamka* (DP48) pochodzi z upstreamu. W profilu tuya-local kierunek
  dla tych zamków to DP78 (`special_control`). Jeśli potrzebujesz zmiany kierunku, użyj `set_datapoint`
  z `dp_id: 78`, `type: bool`.
