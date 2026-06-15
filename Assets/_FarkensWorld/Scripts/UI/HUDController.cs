using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace FarkensWorld
{
    public sealed class HUDController : MonoBehaviour
    {
        private readonly Queue<string> feed = new Queue<string>();
        private readonly RectTransform[] barFills = new RectTransform[4];
        private readonly Text[] barValues = new Text[4];
        private readonly Image[] hotbarSlots = new Image[Hotbar.SlotCount];
        private readonly Text[] hotbarLabels = new Text[Hotbar.SlotCount];

        private GameObject root;
        private CanvasGroup rootGroup;
        private GameObject compassPanel;
        private GameObject performancePanel;
        private GameObject weatherPanel;
        private GameObject miniMapPanel;
        private GameObject hintsPanel;
        private PlayerInteraction interaction;
        private Text compassLabel;
        private Text compassTrack;
        private Text performanceText;
        private Text weatherText;
        private Text conditionText;
        private Text surfaceText;
        private Text statusText;
        private Text feedText;
        private Text centerText;
        private Text promptText;
        private GameObject centerPanel;
        private GameObject promptPanel;
        private RectTransform miniMapMarker;
        private float centerUntil;
        private float smoothFps = 60f;

        private void OnEnable()
        {
            GameEvents.FeedMessage += AddFeed;
            GameEvents.CenterMessage += ShowCenter;
            GameEvents.InventoryChanged += RefreshHotbar;
            GameEvents.HotbarChanged += RefreshHotbar;
        }

        private void OnDisable()
        {
            GameEvents.FeedMessage -= AddFeed;
            GameEvents.CenterMessage -= ShowCenter;
            GameEvents.InventoryChanged -= RefreshHotbar;
            GameEvents.HotbarChanged -= RefreshHotbar;
        }

        private void Start()
        {
            BuildCanvas();
            RefreshHotbar();
            if (GameManager.Instance != null && GameManager.Instance.Settings != null)
            {
                ApplySettings(GameManager.Instance.Settings.Values);
            }
        }

        private void Update()
        {
            GameManager game = GameManager.Instance;
            if (game == null || root == null || game.PlayerStats == null)
            {
                return;
            }

            if (interaction == null && game.PlayerController != null)
            {
                interaction = game.PlayerController.GetComponent<PlayerInteraction>();
            }

            PlayerStatsData stats = game.PlayerStats.Values;
            SetBar(0, stats.health);
            SetBar(1, stats.hunger);
            SetBar(2, stats.thirst);
            SetBar(3, stats.stamina);
            UpdateStatus(stats);
            UpdateCompass(game.PlayerController == null ? 0f : game.PlayerController.Yaw);
            UpdateMiniMap(game);

            smoothFps = Mathf.Lerp(smoothFps, 1f / Mathf.Max(0.0001f, Time.unscaledDeltaTime), 0.08f);
            performanceText.text = "FPS     " + Mathf.RoundToInt(smoothFps) + "\nLAT     local 0ms";
            WorldEnvironment environment = game.Environment;
            weatherText.text = (environment == null ? "CLEAR SKY" : environment.WeatherName) +
                "                         " + (environment == null ? "06:14" : environment.FormattedTime);

            bool showCenter = Time.unscaledTime < centerUntil && !string.IsNullOrEmpty(centerText.text);
            centerPanel.SetActive(showCenter);

            string prompt = interaction == null ? string.Empty : interaction.CurrentPrompt;
            bool showPrompt = !game.GameplayInputBlocked && !string.IsNullOrEmpty(prompt);
            promptPanel.SetActive(showPrompt);
            if (showPrompt)
            {
                promptText.text = prompt;
            }
        }

        private void BuildCanvas()
        {
            root = RuntimeUI.Rect(RuntimeUI.Canvas.transform, "HUD", Vector2.zero, Vector2.one,
                new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero).gameObject;
            rootGroup = root.AddComponent<CanvasGroup>();

            BuildCompass();
            BuildLeftPanels();
            BuildMiniMap();
            BuildStats();
            BuildHotbar();
            BuildMessages();
        }

        private void BuildCompass()
        {
            Image panel = RuntimeUI.Image(root.transform, "Top Compass", new Color(0.035f, 0.059f, 0.086f, 0.88f),
                new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -18f), new Vector2(620f, 54f));
            compassLabel = RuntimeUI.Label(panel.transform, "Bearing", "S 180", 13, RuntimeUI.Accent, TextAnchor.MiddleCenter,
                new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -5f), new Vector2(0f, 20f), FontStyle.Bold);
            compassTrack = RuntimeUI.Label(panel.transform, "Track", "W        NW        N        NE        E", 11, RuntimeUI.Muted, TextAnchor.MiddleCenter,
                new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 5f), new Vector2(-16f, 26f), FontStyle.Bold);
            compassPanel = panel.gameObject;
        }

        private void BuildLeftPanels()
        {
            Image performance = RuntimeUI.Image(root.transform, "Performance", RuntimeUI.Panel,
                new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(18f, -18f), new Vector2(142f, 56f));
            performanceText = RuntimeUI.Label(performance.transform, "Text", "FPS     --\nLAT     local 0ms", 12, RuntimeUI.Text, TextAnchor.MiddleLeft,
                Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(-18f, -8f), FontStyle.Bold);
            performancePanel = performance.gameObject;

            Image weather = RuntimeUI.Image(root.transform, "Weather", RuntimeUI.Panel,
                new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(18f, -84f), new Vector2(254f, 38f));
            RuntimeUI.Image(weather.transform, "Sun", new Color(0.92f, 0.63f, 0.2f, 1f),
                new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(10f, 0f), new Vector2(20f, 20f));
            weatherText = RuntimeUI.Label(weather.transform, "Text", "CLEAR SKY                         06:14", 11, RuntimeUI.Text, TextAnchor.MiddleLeft,
                Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), new Vector2(21f, 0f), new Vector2(-48f, -6f), FontStyle.Bold);
            weatherPanel = weather.gameObject;

            Image hints = RuntimeUI.Image(root.transform, "Hints", RuntimeUI.Panel,
                new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(18f, 18f), new Vector2(420f, 88f));
            RuntimeUI.Label(hints.transform, "Text",
                "LPM těžba/útok | E loot/pít/sebrat | Space skok | F10 dev | Tab inventář | B stavění\nR otočit | U upgrade | T repair | X demolish | M mapa | 1-6 hotbar | H bandage | G jídlo | ESC pauza",
                12, new Color(0.77f, 0.82f, 0.86f, 1f), TextAnchor.MiddleLeft,
                Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(-20f, -16f));
            hintsPanel = hints.gameObject;
        }

        private void BuildMiniMap()
        {
            Image panel = RuntimeUI.Image(root.transform, "Mini Map", RuntimeUI.Panel,
                new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(-18f, -18f), new Vector2(194f, 218f));
            RawImage map = RuntimeUI.Rect(panel.transform, "Map", new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                new Vector2(0.5f, 1f), new Vector2(0f, -8f), new Vector2(178f, 178f)).gameObject.AddComponent<RawImage>();
            map.texture = IslandMapGraphic.Texture;
            map.color = Color.white;
            Image marker = RuntimeUI.Image(map.transform, "Player", new Color(1f, 0.82f, 0.24f, 1f),
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(8f, 8f));
            miniMapMarker = marker.rectTransform;
            RuntimeUI.Label(panel.transform, "Label", "LOCAL MAP", 11, RuntimeUI.Muted, TextAnchor.MiddleCenter,
                new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 7f), new Vector2(0f, 22f), FontStyle.Bold);
            miniMapPanel = panel.gameObject;
        }

        private void BuildStats()
        {
            Image panel = RuntimeUI.Image(root.transform, "Survival", RuntimeUI.Panel,
                new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(-18f, 18f), new Vector2(330f, 226f));
            conditionText = RuntimeUI.Label(root.transform, "Conditions", string.Empty, 12, RuntimeUI.Text, TextAnchor.LowerRight,
                new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(-18f, 252f), new Vector2(360f, 92f), FontStyle.Bold);

            string[] names = { "HP", "FOOD", "WATER", "STAM" };
            Color[] colors =
            {
                new Color(0.557f, 0.89f, 0.247f, 1f),
                new Color(0.82f, 0.482f, 0.145f, 1f),
                new Color(0.18f, 0.616f, 0.839f, 1f),
                new Color(0.851f, 0.706f, 0.282f, 1f)
            };

            for (int i = 0; i < names.Length; i++)
            {
                float y = -14f - i * 31f;
                RuntimeUI.Label(panel.transform, names[i] + " Icon", names[i], 10, RuntimeUI.Muted, TextAnchor.MiddleLeft,
                    new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(12f, y), new Vector2(42f, 20f), FontStyle.Bold);
                Image back = RuntimeUI.Image(panel.transform, names[i] + " Bar", new Color(0.09f, 0.1f, 0.11f, 0.96f),
                    new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(55f, y - 1f), new Vector2(210f, 18f));
                Image fill = RuntimeUI.Image(back.transform, "Fill", colors[i], Vector2.zero, new Vector2(0f, 1f),
                    new Vector2(0f, 0.5f), new Vector2(2f, 0f), new Vector2(206f, -4f));
                barFills[i] = fill.rectTransform;
                barValues[i] = RuntimeUI.Label(panel.transform, names[i] + " Value", "100", 12, RuntimeUI.Text, TextAnchor.MiddleRight,
                    new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(-12f, y), new Vector2(48f, 20f), FontStyle.Bold);
            }

            surfaceText = RuntimeUI.Label(panel.transform, "Surface", "Povrch: Terén | 17 C", 11, RuntimeUI.Muted, TextAnchor.MiddleLeft,
                new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 54f), new Vector2(-24f, 20f));
            RuntimeUI.Label(panel.transform, "Quest", "Úkol: Najdi dřevo, kámen a postav první foundation.", 10, RuntimeUI.Muted, TextAnchor.MiddleLeft,
                new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 31f), new Vector2(-24f, 22f));
            statusText = RuntimeUI.Label(panel.transform, "Status", "Status: OK", 11, RuntimeUI.Text, TextAnchor.MiddleLeft,
                new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 9f), new Vector2(-24f, 20f), FontStyle.Bold);
        }

        private void BuildHotbar()
        {
            Image panel = RuntimeUI.Image(root.transform, "Hotbar", new Color(0.027f, 0.039f, 0.051f, 0.82f),
                new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 18f), new Vector2(472f, 82f));
            for (int i = 0; i < Hotbar.SlotCount; i++)
            {
                float x = -228f + i * 76f;
                hotbarSlots[i] = RuntimeUI.Image(panel.transform, "Slot " + (i + 1), RuntimeUI.Slot,
                    new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(x + 36f, 0f), new Vector2(72f, 72f));
                hotbarLabels[i] = RuntimeUI.Label(hotbarSlots[i].transform, "Text", (i + 1) + "\nEMPTY", 10, RuntimeUI.Muted, TextAnchor.MiddleCenter,
                    Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(-6f, -6f), FontStyle.Bold);
            }
        }

        private void BuildMessages()
        {
            RuntimeUI.Label(root.transform, "Crosshair", "+", 24, Color.white, TextAnchor.MiddleCenter,
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(30f, 30f), FontStyle.Bold);
            feedText = RuntimeUI.Label(root.transform, "Feed", string.Empty, 13, RuntimeUI.Text, TextAnchor.LowerLeft,
                new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(18f, 116f), new Vector2(360f, 140f), FontStyle.Bold);

            centerPanel = RuntimeUI.Image(root.transform, "Center Message", RuntimeUI.Panel,
                new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 124f), new Vector2(460f, 42f)).gameObject;
            centerText = RuntimeUI.Label(centerPanel.transform, "Text", string.Empty, 14, RuntimeUI.Text, TextAnchor.MiddleCenter,
                Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(-18f, -8f), FontStyle.Bold);
            centerPanel.SetActive(false);

            promptPanel = RuntimeUI.Image(root.transform, "Interaction Prompt", RuntimeUI.Panel,
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0f, -72f), new Vector2(380f, 42f)).gameObject;
            promptText = RuntimeUI.Label(promptPanel.transform, "Text", string.Empty, 13, RuntimeUI.Text, TextAnchor.MiddleCenter,
                Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(-18f, -8f), FontStyle.Bold);
            promptPanel.SetActive(false);
        }

        private void SetBar(int index, float value)
        {
            float clamped = Mathf.Clamp(value, 0f, 100f);
            barFills[index].sizeDelta = new Vector2(206f * clamped / 100f, -4f);
            barValues[index].text = Mathf.CeilToInt(clamped).ToString();
        }

        private void UpdateStatus(PlayerStatsData stats)
        {
            List<string> warnings = new List<string>();
            if (stats.bleeding > 1f) warnings.Add("[ BLEEDING " + Mathf.RoundToInt(stats.bleeding) + " ]");
            if (stats.temperature < 4f) warnings.Add("[ COLD " + Mathf.RoundToInt(stats.temperature) + " C ]");
            if (stats.radiation > 1f) warnings.Add("[ RADIATION " + Mathf.RoundToInt(stats.radiation) + " ]");
            if (stats.wetness > 20f) warnings.Add("[ WET " + Mathf.RoundToInt(stats.wetness) + " ]");
            conditionText.text = string.Join("\n", warnings);
            surfaceText.text = "Povrch: Terén | " + Mathf.RoundToInt(stats.temperature) + " C";

            List<string> problems = new List<string>();
            if (stats.hunger < 20f) problems.Add("hlad");
            if (stats.thirst < 20f) problems.Add("žízeň");
            if (stats.bleeding > 1f) problems.Add("krvácení");
            if (stats.temperature < 4f) problems.Add("zima");
            statusText.text = problems.Count == 0 ? "Status: OK" : "Status: " + string.Join(", ", problems);
            statusText.color = problems.Count == 0 ? RuntimeUI.Ok : RuntimeUI.Danger;
        }

        private void UpdateCompass(float yaw)
        {
            float degrees = Mathf.Repeat(yaw, 360f);
            string[] directions = { "N", "NE", "E", "SE", "S", "SW", "W", "NW" };
            string direction = directions[Mathf.RoundToInt(degrees / 45f) % 8];
            compassLabel.text = direction + "  " + Mathf.RoundToInt(degrees) + "°";

            int center = Mathf.RoundToInt(degrees / 45f);
            compassTrack.text = directions[(center + 6) % 8] + "        " + directions[(center + 7) % 8] +
                "        |        " + directions[(center + 1) % 8] + "        " + directions[(center + 2) % 8];
        }

        private void UpdateMiniMap(GameManager game)
        {
            if (miniMapMarker == null || game.PlayerController == null)
            {
                return;
            }

            Vector3 position = game.PlayerController.transform.position;
            miniMapMarker.anchoredPosition = new Vector2(
                Mathf.Clamp(position.x / 75f, -1f, 1f) * 85f,
                Mathf.Clamp(position.z / 75f, -1f, 1f) * 85f);
        }

        private void RefreshHotbar()
        {
            GameManager game = GameManager.Instance;
            if (game == null || hotbarSlots[0] == null)
            {
                return;
            }

            for (int i = 0; i < Hotbar.SlotCount; i++)
            {
                InventorySlot slot = game.PlayerInventory.GetSlot(i);
                bool selected = i == game.Hotbar.SelectedIndex;
                if (slot == null || slot.IsEmpty)
                {
                    hotbarLabels[i].text = (i + 1) + "\n\nEMPTY";
                    hotbarLabels[i].color = RuntimeUI.Muted;
                    hotbarSlots[i].color = selected ? new Color(0.31f, 0.26f, 0.12f, 0.98f) : RuntimeUI.SlotEmpty;
                    continue;
                }

                ItemDefinition item = ItemDatabase.Get(slot.itemId);
                string durability = item.IsDurable ? "\nDUR " + slot.durability : string.Empty;
                hotbarLabels[i].text = (i + 1) + "\n" + item.ShortName + " x" + slot.amount + durability;
                hotbarLabels[i].color = selected ? new Color(1f, 0.95f, 0.8f, 1f) : RuntimeUI.Text;
                hotbarSlots[i].color = selected ? new Color(0.31f, 0.26f, 0.12f, 0.98f) : RuntimeUI.CategoryColor(item.Category);
            }
        }

        private void AddFeed(string message)
        {
            feed.Enqueue(message);
            while (feed.Count > 6)
            {
                feed.Dequeue();
            }

            if (feedText != null)
            {
                feedText.text = string.Join("\n", feed.ToArray());
            }
        }

        private void ShowCenter(string message)
        {
            if (centerText == null)
            {
                return;
            }

            centerText.text = message;
            centerUntil = Time.unscaledTime + 2.4f;
        }

        public void ApplySettings(GameSettingsData settings)
        {
            if (settings == null || root == null)
            {
                return;
            }

            if (rootGroup != null) rootGroup.alpha = settings.hudOpacity;
            if (performancePanel != null) performancePanel.SetActive(settings.showPerformance);
            if (weatherPanel != null) weatherPanel.SetActive(true);
            if (compassPanel != null) compassPanel.SetActive(settings.showCompass);
            if (miniMapPanel != null) miniMapPanel.SetActive(settings.showMiniMap);
            if (hintsPanel != null) hintsPanel.SetActive(settings.showHints);
        }
    }
}
