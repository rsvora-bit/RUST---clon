using UnityEngine;
using UnityEngine.UI;

namespace FarkensWorld
{
    public sealed class SettingsUI : MonoBehaviour
    {
        private static readonly int[] FrameRates = { 30, 60, 90, 120, 0 };

        private GameObject root;
        private Text fovValue;
        private Text sensitivityValue;
        private Text opacityValue;
        private Text sfxValue;
        private Text ambienceValue;
        private Button fpsButton;
        private Button performanceButton;
        private Button compassButton;
        private Button miniMapButton;
        private Button hintsButton;
        private Button muteButton;

        public bool IsOpen { get; private set; }

        private void Start()
        {
            BuildCanvas();
            root.SetActive(false);
            RefreshLabels();
        }

        public void Toggle()
        {
            if (IsOpen) Close(); else Open();
        }

        public void Open()
        {
            GameManager game = GameManager.Instance;
            game.InventoryUI.Close();
            game.BuildUI.Close();
            game.MapUI.Close();
            game.PauseUI.Close();
            IsOpen = true;
            root.SetActive(true);
            RefreshLabels();
        }

        public void Close()
        {
            IsOpen = false;
            if (root != null) root.SetActive(false);
        }

        private void BuildCanvas()
        {
            Image overlay = RuntimeUI.Image(RuntimeUI.Canvas.transform, "Settings Overlay", new Color(0.012f, 0.02f, 0.027f, 0.96f),
                Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            root = overlay.gameObject;
            Image panel = RuntimeUI.Image(root.transform, "Settings", RuntimeUI.Panel,
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(760f, 780f));
            RuntimeUI.Label(panel.transform, "Title", "NASTAVENÍ", 26, RuntimeUI.Accent, TextAnchor.MiddleLeft,
                new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -26f), new Vector2(-160f, 54f), FontStyle.Bold);
            RuntimeUI.Button(panel.transform, "Close", "HOTOVO", Close,
                new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(-16f, -10f), new Vector2(130f, 36f));

            BuildSlider(panel.transform, "FOV", 72f, 55f, 105f, 88f, value =>
            {
                Settings.fieldOfView = value;
                Apply();
            }, out fovValue);
            BuildSlider(panel.transform, "CITLIVOST MYŠI", 0.12f, 0.04f, 0.35f, 168f, value =>
            {
                Settings.mouseSensitivity = value;
                Apply();
            }, out sensitivityValue);
            BuildSlider(panel.transform, "PRŮHLEDNOST HUD", 1f, 0.35f, 1f, 248f, value =>
            {
                Settings.hudOpacity = value;
                Apply();
            }, out opacityValue);
            BuildSlider(panel.transform, "SFX HLASITOST", 0.8f, 0f, 1f, 328f, value =>
            {
                Settings.sfxVolume = value;
                Apply();
            }, out sfxValue);
            BuildSlider(panel.transform, "AMBIENCE HLASITOST", 0.55f, 0f, 1f, 408f, value =>
            {
                Settings.ambienceVolume = value;
                Apply();
            }, out ambienceValue);

            fpsButton = AddToggleButton(panel.transform, "FPS LIMIT", 494f, CycleFrameRate);
            performanceButton = AddToggleButton(panel.transform, "PERFORMANCE HUD", 542f, () => ToggleSetting(nameof(GameSettingsData.showPerformance)));
            compassButton = AddToggleButton(panel.transform, "KOMPAS", 590f, () => ToggleSetting(nameof(GameSettingsData.showCompass)));
            miniMapButton = AddToggleButton(panel.transform, "MINIMAPA", 638f, () => ToggleSetting(nameof(GameSettingsData.showMiniMap)));
            hintsButton = AddToggleButton(panel.transform, "NÁPOVĚDA", 686f, () => ToggleSetting(nameof(GameSettingsData.showHints)));
            muteButton = RuntimeUI.Button(panel.transform, "Mute", "MUTE ALL", () =>
            {
                Settings.muteAll = !Settings.muteAll;
                Apply();
            }, new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(-28f, 24f), new Vector2(180f, 42f), RuntimeUI.Danger, 13);
        }

        private void BuildSlider(Transform parent, string label, float fallback, float min, float max, float top,
            UnityEngine.Events.UnityAction<float> changed, out Text valueLabel)
        {
            RuntimeUI.Label(parent, label, label, 13, RuntimeUI.Text, TextAnchor.MiddleLeft,
                new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(34f, -top), new Vector2(210f, 30f), FontStyle.Bold);
            valueLabel = RuntimeUI.Label(parent, label + " Value", fallback.ToString("0.00"), 12, RuntimeUI.Accent, TextAnchor.MiddleRight,
                new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(-34f, -top), new Vector2(120f, 30f), FontStyle.Bold);
            float current = fallback;
            if (label == "FOV") current = Settings.fieldOfView;
            else if (label == "CITLIVOST MYŠI") current = Settings.mouseSensitivity;
            else if (label == "PRŮHLEDNOST HUD") current = Settings.hudOpacity;
            else if (label == "SFX HLASITOST") current = Settings.sfxVolume;
            else if (label == "AMBIENCE HLASITOST") current = Settings.ambienceVolume;
            RuntimeUI.Slider(parent, label + " Slider", min, max, current, value => changed.Invoke(value),
                new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -top - 35f), new Vector2(-68f, 20f));
        }

        private Button AddToggleButton(Transform parent, string label, float top, UnityEngine.Events.UnityAction clicked)
        {
            return RuntimeUI.Button(parent, label, label, () => clicked(), new Vector2(0f, 1f), new Vector2(1f, 1f),
                new Vector2(0.5f, 1f), new Vector2(0f, -top), new Vector2(-68f, 38f), RuntimeUI.PanelSoft, 12);
        }

        private GameSettingsData Settings => GameManager.Instance.Settings.Values;

        private void Apply()
        {
            GameManager.Instance.Settings.Apply();
            RefreshLabels();
        }

        private void CycleFrameRate()
        {
            int currentIndex = 0;
            for (int i = 0; i < FrameRates.Length; i++)
            {
                if (FrameRates[i] == Settings.targetFrameRate) currentIndex = i;
            }
            Settings.targetFrameRate = FrameRates[(currentIndex + 1) % FrameRates.Length];
            Apply();
        }

        private void ToggleSetting(string field)
        {
            if (field == nameof(GameSettingsData.showPerformance)) Settings.showPerformance = !Settings.showPerformance;
            else if (field == nameof(GameSettingsData.showCompass)) Settings.showCompass = !Settings.showCompass;
            else if (field == nameof(GameSettingsData.showMiniMap)) Settings.showMiniMap = !Settings.showMiniMap;
            else if (field == nameof(GameSettingsData.showHints)) Settings.showHints = !Settings.showHints;
            Apply();
        }

        private void RefreshLabels()
        {
            if (fovValue == null || GameManager.Instance == null) return;
            fovValue.text = Mathf.RoundToInt(Settings.fieldOfView) + "°";
            sensitivityValue.text = Settings.mouseSensitivity.ToString("0.00");
            opacityValue.text = Mathf.RoundToInt(Settings.hudOpacity * 100f) + "%";
            sfxValue.text = Mathf.RoundToInt(Settings.sfxVolume * 100f) + "%";
            ambienceValue.text = Mathf.RoundToInt(Settings.ambienceVolume * 100f) + "%";
            RuntimeUI.SetButtonText(fpsButton, "FPS LIMIT                         " + (Settings.targetFrameRate <= 0 ? "UNLIMITED" : Settings.targetFrameRate.ToString()));
            RuntimeUI.SetButtonText(performanceButton, ToggleText("PERFORMANCE HUD", Settings.showPerformance));
            RuntimeUI.SetButtonText(compassButton, ToggleText("KOMPAS", Settings.showCompass));
            RuntimeUI.SetButtonText(miniMapButton, ToggleText("MINIMAPA", Settings.showMiniMap));
            RuntimeUI.SetButtonText(hintsButton, ToggleText("NÁPOVĚDA", Settings.showHints));
            RuntimeUI.SetButtonText(muteButton, Settings.muteAll ? "MUTE ALL                         ON" : "MUTE ALL                         OFF");
        }

        private static string ToggleText(string label, bool enabled)
        {
            return label + "                         " + (enabled ? "ON" : "OFF");
        }
    }
}
