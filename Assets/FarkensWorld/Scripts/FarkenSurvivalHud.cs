using UnityEngine;

namespace FarkensWorld
{
    public sealed class FarkenSurvivalHud : MonoBehaviour
    {
        private FarkenPlayerController player;
        private GUIStyle titleStyle;
        private GUIStyle labelStyle;
        private GUIStyle smallStyle;
        private GUIStyle centeredStyle;

        private void Awake()
        {
            player = GetComponent<FarkenPlayerController>();
        }

        private void Update()
        {
            if (player == null)
            {
                return;
            }

            player.Hunger = Mathf.Max(0f, player.Hunger - 0.28f * Time.deltaTime);
            player.Thirst = Mathf.Max(0f, player.Thirst - 0.46f * Time.deltaTime);

            if (player.Hunger <= 0f || player.Thirst <= 0f)
            {
                player.Health = Mathf.Max(0f, player.Health - 2.5f * Time.deltaTime);
            }
        }

        private void OnGUI()
        {
            if (player == null)
            {
                return;
            }

            EnsureStyles();
            DrawHeader();
            DrawSurvivalBars();
            DrawInventory();
            DrawCrosshair();
            DrawInteraction();
        }

        private void DrawHeader()
        {
            GUI.Box(new Rect(18f, 18f, 310f, 82f), GUIContent.none);
            GUI.Label(new Rect(34f, 29f, 270f, 30f), "FARKEN'S WORLD", titleStyle);
            GUI.Label(new Rect(34f, 61f, 270f, 24f), "Unity prototype 0.1 | procedural test island", smallStyle);
        }

        private void DrawSurvivalBars()
        {
            float panelY = Screen.height - 142f;
            GUI.Box(new Rect(18f, panelY, 330f, 124f), GUIContent.none);
            DrawBar(new Rect(34f, panelY + 18f, 298f, 22f), player.Health, new Color(0.76f, 0.2f, 0.16f), $"HEALTH  {Mathf.CeilToInt(player.Health)}");
            DrawBar(new Rect(34f, panelY + 50f, 298f, 22f), player.Hunger, new Color(0.8f, 0.55f, 0.14f), $"HUNGER  {Mathf.CeilToInt(player.Hunger)}");
            DrawBar(new Rect(34f, panelY + 82f, 298f, 22f), player.Thirst, new Color(0.15f, 0.55f, 0.82f), $"THIRST  {Mathf.CeilToInt(player.Thirst)}");
        }

        private void DrawInventory()
        {
            float x = Screen.width - 254f;
            float y = Screen.height - 142f;
            GUI.Box(new Rect(x, y, 236f, 124f), GUIContent.none);
            GUI.Label(new Rect(x + 16f, y + 14f, 200f, 24f), "BACKPACK", labelStyle);
            GUI.Label(new Rect(x + 16f, y + 48f, 200f, 24f), $"WOOD       {player.Wood}", labelStyle);
            GUI.Label(new Rect(x + 16f, y + 78f, 200f, 24f), $"STONE      {player.Stone}", labelStyle);
        }

        private void DrawCrosshair()
        {
            float centerX = Screen.width * 0.5f;
            float centerY = Screen.height * 0.5f;
            GUI.DrawTexture(new Rect(centerX - 8f, centerY - 1f, 16f, 2f), Texture2D.whiteTexture);
            GUI.DrawTexture(new Rect(centerX - 1f, centerY - 8f, 2f, 16f), Texture2D.whiteTexture);
        }

        private void DrawInteraction()
        {
            string text = !string.IsNullOrEmpty(player.Message) ? player.Message : player.LookPrompt;
            if (!string.IsNullOrEmpty(text))
            {
                GUI.Box(new Rect(Screen.width * 0.5f - 170f, Screen.height * 0.62f, 340f, 38f), GUIContent.none);
                GUI.Label(new Rect(Screen.width * 0.5f - 160f, Screen.height * 0.62f + 7f, 320f, 24f), text, centeredStyle);
            }

            GUI.Label(new Rect(Screen.width * 0.5f - 260f, Screen.height - 34f, 520f, 24f), "WASD move | Shift sprint | Space jump | E gather | Esc cursor", centeredStyle);
        }

        private void DrawBar(Rect rect, float value, Color fillColor, string text)
        {
            GUI.DrawTexture(rect, Texture2D.whiteTexture, ScaleMode.StretchToFill, true, 0f, new Color(0.04f, 0.05f, 0.06f, 0.9f), 0f, 4f);
            Rect fill = new Rect(rect.x + 2f, rect.y + 2f, (rect.width - 4f) * Mathf.Clamp01(value / 100f), rect.height - 4f);
            GUI.DrawTexture(fill, Texture2D.whiteTexture, ScaleMode.StretchToFill, true, 0f, fillColor, 0f, 3f);
            GUI.Label(rect, text, centeredStyle);
        }

        private void EnsureStyles()
        {
            if (titleStyle != null)
            {
                return;
            }

            titleStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 22,
                fontStyle = FontStyle.Bold,
                normal = { textColor = new Color(0.95f, 0.78f, 0.3f) }
            };
            labelStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 15,
                fontStyle = FontStyle.Bold,
                normal = { textColor = Color.white }
            };
            smallStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 12,
                normal = { textColor = new Color(0.72f, 0.78f, 0.82f) }
            };
            centeredStyle = new GUIStyle(labelStyle)
            {
                alignment = TextAnchor.MiddleCenter,
                fontSize = 13
            };
        }
    }
}
