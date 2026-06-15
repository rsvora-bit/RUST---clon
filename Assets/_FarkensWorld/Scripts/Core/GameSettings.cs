using System;
using UnityEngine;

namespace FarkensWorld
{
    [Serializable]
    public sealed class GameSettingsData
    {
        public float fieldOfView = 72f;
        public float mouseSensitivity = 0.12f;
        public float hudOpacity = 1f;
        public int targetFrameRate = 60;
        public bool showPerformance = true;
        public bool showCompass = true;
        public bool showMiniMap = true;
        public bool showHints = true;
        public float sfxVolume = 0.8f;
        public float ambienceVolume = 0.55f;
        public bool muteAll;
    }

    public sealed class GameSettings : MonoBehaviour
    {
        [SerializeField] private GameSettingsData values = new GameSettingsData();

        public GameSettingsData Values => values;

        public void Apply()
        {
            values.fieldOfView = Mathf.Clamp(values.fieldOfView, 55f, 105f);
            values.mouseSensitivity = Mathf.Clamp(values.mouseSensitivity, 0.04f, 0.35f);
            values.hudOpacity = Mathf.Clamp(values.hudOpacity, 0.35f, 1f);
            values.sfxVolume = Mathf.Clamp01(values.sfxVolume);
            values.ambienceVolume = Mathf.Clamp01(values.ambienceVolume);
            Application.targetFrameRate = values.targetFrameRate <= 0 ? -1 : values.targetFrameRate;
            QualitySettings.vSyncCount = 0;
            AudioListener.volume = values.muteAll ? 0f : values.sfxVolume;

            GameManager game = GameManager.Instance;
            if (game == null)
            {
                return;
            }

            if (game.PlayerController != null)
            {
                game.PlayerController.MouseSensitivity = values.mouseSensitivity;
                if (game.PlayerController.PlayerCamera != null)
                {
                    game.PlayerController.PlayerCamera.fieldOfView = values.fieldOfView;
                }
            }

            HUDController hud = game.GetComponent<HUDController>();
            if (hud != null)
            {
                hud.ApplySettings(values);
            }
        }

        public void Restore(GameSettingsData data)
        {
            values = Copy(data ?? new GameSettingsData());
            Apply();
        }

        public GameSettingsData CreateSnapshot()
        {
            return Copy(values);
        }

        private static GameSettingsData Copy(GameSettingsData source)
        {
            return new GameSettingsData
            {
                fieldOfView = source.fieldOfView,
                mouseSensitivity = source.mouseSensitivity,
                hudOpacity = source.hudOpacity,
                targetFrameRate = source.targetFrameRate,
                showPerformance = source.showPerformance,
                showCompass = source.showCompass,
                showMiniMap = source.showMiniMap,
                showHints = source.showHints,
                sfxVolume = source.sfxVolume,
                ambienceVolume = source.ambienceVolume,
                muteAll = source.muteAll
            };
        }
    }
}
