# Farken's World - Unity Beta 1.6.0

Tento repozitář obsahuje novou Unity verzi hry Farken's World.

Původní hra vznikala jako single-file HTML/Three.js survival prototyp.  
Unity verze navazuje na hlavní mechaniky z HTML verze, ale nepoužívá HTML WebView. Cílem je vytvořit skutečný Unity C# survival projekt.

## Původní HTML prototyp

Archiv HTML verzí je zde:

[ODKAZ_NA_HTML_ARCHIVE_REPO](https://github.com/rsvora-bit/it2b_prog_/blob/main/Projekty/Projekt/HTML%20Prototype%20Archive/latest-html/Farkens_World_Beta_1.5.1.html)

Nejnovější HTML reference: Beta 1.5.1

## Cílové mechaniky Unity verze

- first person controller
- survival stats
- inventory + hotbar
- crafting queue
- storage boxy
- furnace
- workbench levely
- building systém
- loot tables
- dropped itemy
- bow projectile
- corpse loot
- save/load
- dev console

## Stav projektu

Unity Beta 1.6.0 je hratelný procedurální survival prototyp. Obsahuje počasí a den/noc, AI zvířata a scientisty, fyzický luk, corpse loot, smrt/respawn, runtime settings, procedurální audio a robustnější save/load.

Projekt otevři v Unity Hubu přes **Add project from disk** a vyber tuto složku. Požadovaná verze editoru je Unity `6000.4.11f1`; hlavní scéna je `Assets/_FarkensWorld/Scenes/Main.unity`.

Aktuální implementační stav a příkazy jsou v [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md).
