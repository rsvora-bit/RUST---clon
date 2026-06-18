using System.Collections.Generic;
using System.Globalization;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace FarkensWorld
{
    public sealed class DevConsoleUI : MonoBehaviour
    {
        private readonly List<string> output = new List<string>();
        private GameObject root;
        private Text logText;
        private InputField commandInput;

        public bool IsOpen { get; private set; }

        private void Start()
        {
            BuildCanvas();
            Log("help - seznam příkazů");
            root.SetActive(false);
        }

        private void Update()
        {
            Keyboard keyboard = Keyboard.current;
            if (keyboard == null)
            {
                return;
            }

            if (keyboard.backquoteKey.wasPressedThisFrame || keyboard.f10Key.wasPressedThisFrame)
            {
                SetOpen(!IsOpen);
                return;
            }

            if (IsOpen && (keyboard.enterKey.wasPressedThisFrame || keyboard.numpadEnterKey.wasPressedThisFrame))
            {
                RunCommand();
            }
        }

        private void BuildCanvas()
        {
            Image panel = RuntimeUI.Image(RuntimeUI.Canvas.transform, "Developer Console", new Color(0.024f, 0.039f, 0.051f, 0.97f),
                new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(24f, -86f), new Vector2(560f, 330f));
            root = panel.gameObject;
            RuntimeUI.Label(panel.transform, "Title", "PRIVATE DEV TERMINAL", 13, new Color(0.62f, 0.87f, 0.96f, 1f), TextAnchor.MiddleLeft,
                new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -10f), new Vector2(-120f, 32f), FontStyle.Bold);
            RuntimeUI.Button(panel.transform, "Close", "ZAVŘÍT", () => SetOpen(false),
                new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(-10f, -8f), new Vector2(94f, 30f),
                new Color(0.071f, 0.133f, 0.169f, 0.92f), 11);
            Image log = RuntimeUI.Image(panel.transform, "Log", new Color(0f, 0f, 0f, 0.48f),
                new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -48f), new Vector2(-24f, 218f));
            logText = RuntimeUI.Label(log.transform, "Text", string.Empty, 12, new Color(0.78f, 0.83f, 0.86f, 1f), TextAnchor.LowerLeft,
                Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(-16f, -12f));
            commandInput = RuntimeUI.Input(panel.transform, "Input", "např. god on, fly on, give wood 100, tp spawn",
                new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(-48f, 12f), new Vector2(-120f, 38f));
            RuntimeUI.Button(panel.transform, "Run", "RUN", RunCommand,
                new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(-12f, 12f), new Vector2(94f, 38f),
                new Color(0.071f, 0.133f, 0.169f, 0.92f), 12);
        }

        private void SetOpen(bool open)
        {
            IsOpen = open;
            if (root != null)
            {
                root.SetActive(open);
            }

            if (open && commandInput != null)
            {
                commandInput.ActivateInputField();
                commandInput.Select();
            }
        }

        private void RunCommand()
        {
            string raw = commandInput == null ? string.Empty : commandInput.text.Trim();
            if (commandInput != null)
            {
                commandInput.text = string.Empty;
                commandInput.ActivateInputField();
            }

            if (string.IsNullOrEmpty(raw))
            {
                return;
            }

            Log("> " + raw);
            string[] parts = raw.Split(' ');
            string verb = parts[0].ToLowerInvariant();
            GameManager game = GameManager.Instance;

            switch (verb)
            {
                case "help":
                    Log("help | give <itemId> <amount> | giveall | clearinventory | respawn | tp spawn");
                    Log("damage 20 | bleed 20 | wet 50 | rad 20 | heal/feed/drink | god/fly on/off/toggle");
                    Log("weather clear/rain/storm/fog | time 0-24/day/night/noon");
                    Log("spawn deer/boar/wolf/scientist <amount> | kill animals/all/type");
                    Log("save | load | report | clear drops/build | newgame");
                    break;
                case "give":
                    if (parts.Length >= 3 && ItemDatabase.Contains(parts[1]) && int.TryParse(parts[2], out int amount))
                    {
                        int remainder = game.PlayerInventory.Add(parts[1], amount);
                        Log("Přidáno " + (amount - remainder) + " " + parts[1]);
                    }
                    else Log("Použití: give itemId amount");
                    break;
                case "giveall":
                    foreach (ItemDefinition item in ItemDatabase.All) game.PlayerInventory.Add(item.Id, item.IsDurable ? 1 : Mathf.Min(100, item.StackLimit));
                    Log("Přidána testovací sada všech itemů");
                    break;
                case "clearinventory":
                    game.PlayerInventory.Clear();
                    Log("Inventář vyčištěn");
                    break;
                case "heal":
                    game.PlayerStats.Heal(100f);
                    Log("Zdraví obnoveno");
                    break;
                case "feed":
                    game.PlayerStats.Feed(100f);
                    Log("Hlad doplněn");
                    break;
                case "drink":
                    game.PlayerStats.Drink(100f);
                    Log("Žízeň doplněna");
                    break;
                case "respawn":
                    game.Respawn();
                    Log("Respawn spuštěn");
                    break;
                case "damage":
                    if (TryReadFloat(parts, 1, 20f, out float damage))
                    {
                        game.PlayerStats.Damage(damage);
                        Log("Damage " + damage.ToString("0.##", CultureInfo.InvariantCulture));
                    }
                    else Log("Použití: damage 20");
                    break;
                case "bleed":
                    if (TryReadFloat(parts, 1, 20f, out float bleed))
                    {
                        game.PlayerStats.AddBleeding(bleed);
                        Log("Bleeding +" + bleed.ToString("0.##", CultureInfo.InvariantCulture));
                    }
                    else Log("Použití: bleed 20");
                    break;
                case "wet":
                    if (TryReadFloat(parts, 1, 50f, out float wet))
                    {
                        game.PlayerStats.AddWetness(wet);
                        Log("Wetness +" + wet.ToString("0.##", CultureInfo.InvariantCulture));
                    }
                    else Log("Použití: wet 50");
                    break;
                case "rad":
                    if (TryReadFloat(parts, 1, 20f, out float rad))
                    {
                        game.PlayerStats.AddRadiation(rad);
                        Log("Radiation +" + rad.ToString("0.##", CultureInfo.InvariantCulture));
                    }
                    else Log("Použití: rad 20");
                    break;
                case "tp":
                    if (parts.Length > 1 && parts[1].ToLowerInvariant() == "spawn")
                    {
                        game.PlayerController.Teleport(game.World.PlayerSpawn);
                        Log("Teleport na spawn");
                    }
                    else Log("Použití: tp spawn");
                    break;
                case "god":
                    game.PlayerStats.GodMode = ResolveToggle(parts, game.PlayerStats.GodMode);
                    Log("God mode: " + game.PlayerStats.GodMode);
                    break;
                case "fly":
                    game.PlayerController.FlyMode = ResolveToggle(parts, game.PlayerController.FlyMode);
                    Log("Fly mode: " + game.PlayerController.FlyMode);
                    break;
                case "weather":
                    if (parts.Length > 1 && System.Enum.TryParse(parts[1], true, out WeatherType requestedWeather))
                    {
                        game.Environment.SetWeather(requestedWeather);
                        Log("Weather: " + requestedWeather);
                    }
                    else Log("Použití: weather clear/rain/storm/fog");
                    break;
                case "time":
                    if (parts.Length <= 1)
                    {
                        Log("Time: " + game.Environment.FormattedTime);
                    }
                    else
                    {
                        string timeValue = parts[1].ToLowerInvariant();
                        float hour = timeValue == "day" ? 9f : timeValue == "noon" ? 12f : timeValue == "night" ? 22f : timeValue == "midnight" ? 0f : -1f;
                        if (hour < 0f && !float.TryParse(timeValue, NumberStyles.Float, CultureInfo.InvariantCulture, out hour))
                        {
                            Log("Použití: time 0-24/day/night/noon/midnight");
                        }
                        else
                        {
                            game.Environment.SetTime(hour);
                            Log("Time: " + game.Environment.FormattedTime);
                        }
                    }
                    break;
                case "spawn":
                    if (parts.Length > 1 && System.Enum.TryParse(parts[1], true, out WorldActorKind actorKind))
                    {
                        int actorCount = 1;
                        if (parts.Length > 2) int.TryParse(parts[2], out actorCount);
                        actorCount = Mathf.Clamp(actorCount, 1, 20);
                        for (int i = 0; i < actorCount; i++)
                        {
                            Vector3 offset = game.PlayerController.transform.forward * (7f + i * 1.8f) + game.PlayerController.transform.right * ((i % 3) - 1) * 2f;
                            game.Population.Spawn(actorKind, game.PlayerController.transform.position + offset);
                        }
                        Log("Spawned " + actorKind + " x" + actorCount);
                    }
                    else Log("Použití: spawn deer/boar/wolf/scientist 1");
                    break;
                case "kill":
                    string selector = parts.Length > 1 ? parts[1] : "all";
                    Log("Killed " + game.Population.Kill(selector) + " actors");
                    break;
                case "save":
                    game.Saves.SaveGame();
                    Log("Uloženo do " + game.Saves.SavePath);
                    break;
                case "load":
                    game.Saves.LoadGame();
                    Log("Načtení spuštěno");
                    break;
                case "newgame":
                    game.NewGame();
                    Log("Vygenerován nový ostrov");
                    break;
                case "report":
                    FirstPersonController controller = game.PlayerController;
                    string groundName = "none";
                    if (controller != null && controller.TryGetGroundHit(out RaycastHit groundHit) && groundHit.collider != null)
                    {
                        groundName = groundHit.collider.name + " (" + groundHit.collider.GetType().Name + ")";
                    }

                    Log(GameManager.Version + " | seed " + game.World.WorldSeed);
                    Log("Pozice " + (controller == null ? Vector3.zero : controller.transform.position) +
                        " | grounded " + (controller != null && controller.IsCharacterGrounded) +
                        " | ground " + groundName);
                    Log("Inventář " + UsedSlots(game.PlayerInventory) + "/28" +
                        " | grass details " + game.World.GrassDetailCount);
                    PlayerCombat combat = game.PlayerController.GetComponent<PlayerCombat>();
                    Log("Drops " + game.Drops.ActiveCount + " | builds " + game.Building.PlacedPieces.Count +
                        " | actors " + game.Population.ActiveCount +
                        " D/B/W/S " + game.Population.Count(WorldActorKind.Deer) + "/" +
                        game.Population.Count(WorldActorKind.Boar) + "/" +
                        game.Population.Count(WorldActorKind.Wolf) + "/" +
                        game.Population.Count(WorldActorKind.Scientist));
                    Log("Weather " + game.Environment.WeatherName + " " + game.Environment.FormattedTime + " | arrows " + (combat == null ? 0 : combat.ActiveProjectileCount));
                    break;
                case "clear":
                    if (parts.Length > 1 && parts[1] == "drops") { game.Drops.ClearAll(); Log("Drops odstraněny"); }
                    else if (parts.Length > 1 && parts[1] == "build") { game.Building.ClearAll(); Log("Stavby odstraněny"); }
                    else { output.Clear(); RefreshLog(); }
                    break;
                default:
                    Log("Neznámý příkaz. Napiš help.");
                    break;
            }
        }

        private static bool ResolveToggle(string[] parts, bool current)
        {
            string mode = parts.Length > 1 ? parts[1].ToLowerInvariant() : "toggle";
            if (mode == "on") return true;
            if (mode == "off") return false;
            return !current;
        }

        private static bool TryReadFloat(string[] parts, int index, float defaultValue, out float value)
        {
            if (parts.Length <= index)
            {
                value = defaultValue;
                return true;
            }

            return float.TryParse(parts[index], NumberStyles.Float, CultureInfo.InvariantCulture, out value);
        }

        private void Log(string message)
        {
            output.Add(message);
            while (output.Count > 12) output.RemoveAt(0);
            RefreshLog();
        }

        private void RefreshLog()
        {
            if (logText != null)
            {
                logText.text = string.Join("\n", output.ToArray());
            }
        }

        private static int UsedSlots(Inventory inventory)
        {
            int used = 0;
            for (int i = 0; i < inventory.Capacity; i++) if (!inventory.GetSlot(i).IsEmpty) used++;
            return used;
        }
    }
}
