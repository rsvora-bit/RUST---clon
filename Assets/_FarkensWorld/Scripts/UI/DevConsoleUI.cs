using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;

namespace FarkensWorld
{
    public sealed class DevConsoleUI : MonoBehaviour
    {
        private readonly List<string> output = new List<string>();
        private string command = string.Empty;
        private bool focusInput;

        public bool IsOpen { get; private set; }

        private void Update()
        {
            Keyboard keyboard = Keyboard.current;
            if (keyboard != null && (keyboard.backquoteKey.wasPressedThisFrame || keyboard.f10Key.wasPressedThisFrame))
            {
                IsOpen = !IsOpen;
                focusInput = IsOpen;
            }
        }

        private void OnGUI()
        {
            if (!IsOpen) return;
            GUI.Box(new Rect(20f, 20f, Screen.width - 40f, Screen.height * 0.48f), GUIContent.none);
            GUI.Label(new Rect(36f, 30f, 400f, 24f), "DEVELOPER CONSOLE", HeaderStyle());
            int first = Mathf.Max(0, output.Count - 12);
            for (int i = first; i < output.Count; i++)
            {
                GUI.Label(new Rect(36f, 62f + (i - first) * 22f, Screen.width - 72f, 22f), output[i]);
            }

            float inputY = Screen.height * 0.48f - 26f;
            GUI.SetNextControlName("ConsoleInput");
            command = GUI.TextField(new Rect(36f, inputY, Screen.width - 160f, 30f), command);
            if (GUI.Button(new Rect(Screen.width - 112f, inputY, 76f, 30f), "Run")) RunCommand();
            if (focusInput)
            {
                GUI.FocusControl("ConsoleInput");
                focusInput = false;
            }

            Event current = Event.current;
            if (current.type == EventType.KeyDown && (current.keyCode == KeyCode.Return || current.keyCode == KeyCode.KeypadEnter))
            {
                RunCommand();
                current.Use();
            }
        }

        private void RunCommand()
        {
            string raw = command.Trim();
            command = string.Empty;
            if (string.IsNullOrEmpty(raw)) return;
            Log("> " + raw);
            string[] parts = raw.Split(' ');
            string verb = parts[0].ToLowerInvariant();
            GameManager game = GameManager.Instance;

            switch (verb)
            {
                case "help":
                    Log("help | give <itemId> <amount> | giveall | clearinventory | heal | feed | drink");
                    Log("god on/off/toggle | save | load | report | clear drops/build | newgame");
                    break;
                case "give":
                    if (parts.Length >= 3 && ItemDatabase.Contains(parts[1]) && int.TryParse(parts[2], out int amount))
                    {
                        int remainder = game.PlayerInventory.Add(parts[1], amount);
                        Log("Added " + (amount - remainder) + " " + parts[1]);
                    }
                    else Log("Usage: give itemId amount");
                    break;
                case "giveall":
                    foreach (ItemDefinition item in ItemDatabase.All) game.PlayerInventory.Add(item.Id, item.IsDurable ? 1 : Mathf.Min(100, item.StackLimit));
                    Log("Starter batch of every item added");
                    break;
                case "clearinventory": game.PlayerInventory.Clear(); Log("Inventory cleared"); break;
                case "heal": game.PlayerStats.Heal(100f); Log("Health restored"); break;
                case "feed": game.PlayerStats.Feed(100f); Log("Hunger restored"); break;
                case "drink": game.PlayerStats.Drink(100f); Log("Thirst restored"); break;
                case "god":
                    string mode = parts.Length > 1 ? parts[1].ToLowerInvariant() : "toggle";
                    game.PlayerStats.GodMode = mode == "on" || (mode == "toggle" && !game.PlayerStats.GodMode);
                    if (mode == "off") game.PlayerStats.GodMode = false;
                    Log("God mode: " + game.PlayerStats.GodMode);
                    break;
                case "save": game.Saves.SaveGame(); Log("Saved to " + game.Saves.SavePath); break;
                case "load": game.Saves.LoadGame(); Log("Load requested"); break;
                case "newgame": game.NewGame(); Log("New world generated"); break;
                case "report":
                    Log(GameManager.Version + " | seed " + game.World.WorldSeed);
                    Log("Position " + game.PlayerController.transform.position + " | inventory " + UsedSlots(game.PlayerInventory) + "/28");
                    Log("Drops " + game.Drops.ActiveCount + " | builds " + game.Building.PlacedPieces.Count + " | save " + game.Saves.SavePath);
                    break;
                case "clear":
                    if (parts.Length > 1 && parts[1] == "drops") { game.Drops.ClearAll(); Log("Drops cleared"); }
                    else if (parts.Length > 1 && parts[1] == "build") { game.Building.ClearAll(); Log("Build cleared"); }
                    else output.Clear();
                    break;
                default: Log("Unknown command. Type help."); break;
            }
        }

        private void Log(string message)
        {
            output.Add(message);
            while (output.Count > 100) output.RemoveAt(0);
        }

        private static int UsedSlots(Inventory inventory)
        {
            int used = 0;
            for (int i = 0; i < inventory.Capacity; i++) if (!inventory.GetSlot(i).IsEmpty) used++;
            return used;
        }

        private static GUIStyle HeaderStyle()
        {
            GUIStyle style = new GUIStyle(GUI.skin.label) { fontSize = 18, fontStyle = FontStyle.Bold };
            style.normal.textColor = new Color(0.95f, 0.77f, 0.28f);
            return style;
        }
    }
}
