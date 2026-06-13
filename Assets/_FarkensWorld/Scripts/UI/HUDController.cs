using System.Collections.Generic;
using UnityEngine;

namespace FarkensWorld
{
    public sealed class HUDController : MonoBehaviour
    {
        private readonly Queue<string> feed = new Queue<string>();
        private PlayerInteraction interaction;
        private string centerMessage = string.Empty;
        private float centerUntil;
        private GUIStyle titleStyle;
        private GUIStyle labelStyle;
        private GUIStyle centeredStyle;
        private GUIStyle smallStyle;

        private void OnEnable()
        {
            GameEvents.FeedMessage += AddFeed;
            GameEvents.CenterMessage += ShowCenter;
        }

        private void OnDisable()
        {
            GameEvents.FeedMessage -= AddFeed;
            GameEvents.CenterMessage -= ShowCenter;
        }

        private void Update()
        {
            if (interaction == null && GameManager.Instance != null && GameManager.Instance.PlayerController != null)
            {
                interaction = GameManager.Instance.PlayerController.GetComponent<PlayerInteraction>();
            }
        }

        private void OnGUI()
        {
            GameManager game = GameManager.Instance;
            if (game == null || game.PlayerStats == null)
            {
                return;
            }

            EnsureStyles();
            DrawHeader();
            DrawStats(game.PlayerStats.Values);
            DrawHotbar(game);
            DrawMessages();
            DrawInteractionPrompt();
        }

        private void DrawHeader()
        {
            GUI.Box(new Rect(16f, 16f, 320f, 74f), GUIContent.none);
            GUI.Label(new Rect(30f, 25f, 290f, 28f), "FARKEN'S WORLD", titleStyle);
            GUI.Label(new Rect(30f, 55f, 290f, 22f), GameManager.Version + " | seed " + GameManager.Instance.World.WorldSeed, smallStyle);
        }

        private void DrawStats(PlayerStatsData stats)
        {
            float y = Screen.height - 176f;
            GUI.Box(new Rect(16f, y, 330f, 160f), GUIContent.none);
            DrawBar(new Rect(30f, y + 16f, 302f, 21f), stats.health, new Color(0.78f, 0.18f, 0.14f), "HEALTH");
            DrawBar(new Rect(30f, y + 45f, 302f, 21f), stats.hunger, new Color(0.82f, 0.55f, 0.13f), "FOOD");
            DrawBar(new Rect(30f, y + 74f, 302f, 21f), stats.thirst, new Color(0.12f, 0.53f, 0.84f), "WATER");
            DrawBar(new Rect(30f, y + 103f, 302f, 21f), stats.stamina, new Color(0.32f, 0.74f, 0.34f), "STAMINA");
            string status = "RAD " + Mathf.RoundToInt(stats.radiation) + "   WET " + Mathf.RoundToInt(stats.wetness) + "   BLEED " + Mathf.RoundToInt(stats.bleeding);
            GUI.Label(new Rect(30f, y + 130f, 302f, 22f), status, centeredStyle);
        }

        private void DrawHotbar(GameManager game)
        {
            float totalWidth = 6f * 92f;
            float x = Screen.width * 0.5f - totalWidth * 0.5f;
            float y = Screen.height - 94f;
            for (int i = 0; i < Hotbar.SlotCount; i++)
            {
                Rect rect = new Rect(x + i * 92f, y, 86f, 72f);
                Color old = GUI.color;
                GUI.color = i == game.Hotbar.SelectedIndex ? new Color(1f, 0.78f, 0.25f) : Color.white;
                GUI.Box(rect, GUIContent.none);
                GUI.color = old;

                InventorySlot slot = game.PlayerInventory.GetSlot(i);
                string text = (i + 1).ToString();
                if (slot != null && !slot.IsEmpty)
                {
                    ItemDefinition item = ItemDatabase.Get(slot.itemId);
                    text += "\n" + item.ShortName + " x" + slot.amount;
                    if (item.IsDurable)
                    {
                        text += "\n" + slot.durability + "/" + item.MaxDurability;
                    }
                }

                GUI.Label(rect, text, centeredStyle);
            }
        }

        private void DrawMessages()
        {
            GUIStyle crosshair = centeredStyle;
            GUI.Label(new Rect(Screen.width * 0.5f - 12f, Screen.height * 0.5f - 16f, 24f, 24f), "+", crosshair);

            if (Time.time < centerUntil && !string.IsNullOrEmpty(centerMessage))
            {
                GUI.Box(new Rect(Screen.width * 0.5f - 220f, Screen.height * 0.31f, 440f, 42f), GUIContent.none);
                GUI.Label(new Rect(Screen.width * 0.5f - 210f, Screen.height * 0.31f + 8f, 420f, 26f), centerMessage, centeredStyle);
            }

            int index = 0;
            foreach (string message in feed)
            {
                GUI.Label(new Rect(Screen.width - 370f, 24f + index * 22f, 350f, 22f), message, labelStyle);
                index++;
            }
        }

        private void DrawInteractionPrompt()
        {
            if (interaction == null || string.IsNullOrEmpty(interaction.CurrentPrompt) || GameManager.Instance.GameplayInputBlocked)
            {
                return;
            }

            GUI.Box(new Rect(Screen.width * 0.5f - 190f, Screen.height * 0.62f, 380f, 38f), GUIContent.none);
            GUI.Label(new Rect(Screen.width * 0.5f - 180f, Screen.height * 0.62f + 7f, 360f, 24f), interaction.CurrentPrompt, centeredStyle);
        }

        private void DrawBar(Rect rect, float value, Color color, string label)
        {
            Color old = GUI.color;
            GUI.color = new Color(0.12f, 0.13f, 0.14f, 0.95f);
            GUI.DrawTexture(rect, Texture2D.whiteTexture);
            GUI.color = color;
            GUI.DrawTexture(new Rect(rect.x + 2f, rect.y + 2f, (rect.width - 4f) * Mathf.Clamp01(value / 100f), rect.height - 4f), Texture2D.whiteTexture);
            GUI.color = old;
            GUI.Label(rect, label + "  " + Mathf.CeilToInt(value), centeredStyle);
        }

        private void AddFeed(string message)
        {
            feed.Enqueue(message);
            while (feed.Count > 6)
            {
                feed.Dequeue();
            }
        }

        private void ShowCenter(string message)
        {
            centerMessage = message;
            centerUntil = Time.time + 2.4f;
        }

        private void EnsureStyles()
        {
            if (titleStyle != null)
            {
                return;
            }

            titleStyle = new GUIStyle(GUI.skin.label) { fontSize = 22, fontStyle = FontStyle.Bold };
            titleStyle.normal.textColor = new Color(0.96f, 0.77f, 0.25f);
            labelStyle = new GUIStyle(GUI.skin.label) { fontSize = 13, fontStyle = FontStyle.Bold };
            labelStyle.normal.textColor = Color.white;
            centeredStyle = new GUIStyle(labelStyle) { alignment = TextAnchor.MiddleCenter, wordWrap = true };
            smallStyle = new GUIStyle(GUI.skin.label) { fontSize = 12 };
            smallStyle.normal.textColor = new Color(0.72f, 0.78f, 0.82f);
        }
    }
}
