# Farken's World Unity docs

Tahle složka je pracovní centrum pro další vývoj Unity portu. Codex má nejdřív číst dokumenty tady, až potom upravovat kód.

## Jak má Codex postupovat

1. Přečíst `docs/README.md`.
2. Přečíst `docs/CODEX_NEXT_PROMPT.md`.
3. Přečíst `docs/IMPLEMENTATION_STATUS.md`.
4. Přečíst `docs/HTML_PORT_MAPPING.md`.
5. Otevřít a otestovat `Assets/_FarkensWorld/Scenes/Main.unity`.
6. Nevěřit slepě statusům `DONE`; pokud něco neprojde v Play Mode, přepsat to na `PARTIAL` nebo `BROKEN`.
7. Až potom dělat změny v kódu.

## Hlavní dokumenty

| Soubor | K čemu slouží |
|---|---|
| `CODEX_NEXT_PROMPT.md` | Hlavní zadání pro další běh Codexu. Tento soubor má Codex brát jako primární prompt. |
| `IMPLEMENTATION_STATUS.md` | Přehled co je hotové, částečné, rozbité nebo TODO. |
| `HTML_PORT_MAPPING.md` | Mapování HTML funkcí na Unity skripty / objekty. |
| `NEXT_STEPS.md` | Konkrétní checklist dalších úkolů v pořadí. |

## Aktuální priorita

Teď není hlavní priorita přidávat nové funkce. Hlavní priorita je stabilita a pravdivý audit:

1. Ověřit collider patch v `WorldGenerator.cs`.
2. Ověřit, že hráč neleviduje, nepadá a dostane se do středu ostrova.
3. Ověřit, že Console nemá red errors.
4. Ověřit Beta 1.6 systémy: weather, settings, AI, bow, corpse loot, death screen, save/load.
5. Až potom ladit UI, vizuál a nové funkce.

## Pravidlo pro dokumentaci

Status `DONE` smí být jen u věci, která:

- existuje v kódu,
- běží v Unity bez compile/runtime erroru,
- byla fyzicky otestovaná v Play Mode,
- odpovídá aspoň zjednodušeně HTML referenci.

Když něco pouze existuje v souboru, ale nebylo otestované v editoru, má být `PARTIAL`.

Když něco vypadá hotově, ale při gameplayi nefunguje, má být `BROKEN`.

## Krátký prompt, který můžeš dát Codexu

Použij tento text jako krátké zadání:

```text
Přečti nejdřív docs/README.md a potom docs/CODEX_NEXT_PROMPT.md. Řiď se tím jako hlavním zadáním. Nezačínej od nuly, nepoužívej WebView, pracuj v existujícím Unity projektu a po každé změně aktualizuj docs/IMPLEMENTATION_STATUS.md a docs/HTML_PORT_MAPPING.md podle reality z Play Mode testu.
```
