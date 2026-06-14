# Struktura Unity projektu – Farken's World

Tahle struktura je připravená pro postupný port HTML/Three.js verze do Unity. Cíl je nedělat projekt znovu od nuly, ale přepsat mechaniky z HTML verze do čistého Unity/C# projektu.

## Hlavní pravidlo

Unity projekt drž jako běžný Unity projekt:

- `Assets/` – herní obsah, skripty, scény, prefaby, materiály, UI.
- `Packages/` – Unity package manifest, až projekt vznikne přes Unity Hub.
- `ProjectSettings/` – Unity nastavení projektu, až projekt vznikne přes Unity Hub.
- `docs/` – zadání, prompt plány, checklisty a technická dokumentace.

## Doporučené složky v Assets/_Project

```text
Assets/_Project/
  Scenes/              hlavní scény hry
  Scripts/             veškerý vlastní C# kód
    Core/              GameManager, bootstrap, global state
    Player/            pohyb, kamera, input, survival controller
    Inventory/         slot inventory, hotbar, containers
    Crafting/          recipes, crafting queue, workbench tiers
    Building/          building plan, snap, upgrade, repair, demolish
    World/             terrain, spawnery, loot nodes, weather, day/night
    Combat/            melee, bow projectile, hit detection
    UI/                HUD, inventory UI, map UI, dev console UI
    SaveSystem/        save/load, migration, serialization
    DevTools/          debug console, cheat commands, diagnostics
  Prefabs/             prefaby hráče, itemů, build dílů, containerů
  Materials/           materiály pro styl podobný HTML verzi/Rust-like UI
  Textures/Procedural/ procedurální nebo později vytvořené textury
  UI/                  canvasy, fonty, UI prefaby
  Data/                ScriptableObjects: itemy, recipes, loot tables
  Audio/Procedural/    audio placeholdery nebo procedurální audio setup
  Art/Placeholder/     dočasné modely, než budou hotové finální assety
```

## Co se má portovat z HTML verze

- First person ovládání.
- HUD se survival staty vpravo dole.
- Hotbar dole uprostřed.
- Kompas nahoře.
- Minimapa vpravo nahoře.
- Inventář ve stylu Rust/HTML verze.
- Slotový inventář, stack limity, storage boxy.
- Crafting queue, workbench levely.
- Furnace input/fuel/output.
- Building plan, snapování, upgrade, repair, demolish.
- Loot tables, dropped itemy, corpse loot.
- Bow projectile.
- Save/load a dev console.

## Důležité pro Codex

Codex musí pracovat do těchto složek, neházet všechno do rootu. Když vytváří skript, musí ho dát do odpovídající podsložky pod `Assets/_Project/Scripts/`.
