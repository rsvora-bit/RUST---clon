using UnityEngine;
using UnityEngine.UI;

namespace FarkensWorld
{
    public sealed class PauseMenuUI : MonoBehaviour
    {
        private GameObject root;

        public bool IsOpen { get; private set; }

        private void Start()
        {
            BuildCanvas();
            root.SetActive(false);
        }

        public void Toggle()
        {
            IsOpen = !IsOpen;
            Time.timeScale = IsOpen ? 0f : 1f;
            if (root != null)
            {
                root.SetActive(IsOpen);
            }
        }

        public void Close()
        {
            if (!IsOpen)
            {
                return;
            }

            IsOpen = false;
            Time.timeScale = 1f;
            if (root != null)
            {
                root.SetActive(false);
            }
        }

        private void BuildCanvas()
        {
            Image overlay = RuntimeUI.Image(RuntimeUI.Canvas.transform, "Pause Overlay", new Color(0.01f, 0.015f, 0.02f, 0.78f),
                Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            root = overlay.gameObject;
            Image panel = RuntimeUI.Image(root.transform, "Pause", RuntimeUI.Panel,
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(420f, 644f));
            RuntimeUI.Label(panel.transform, "Title", "PAUZA", 28, RuntimeUI.Accent, TextAnchor.MiddleCenter,
                new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -24f), new Vector2(-30f, 56f), FontStyle.Bold);

            AddButton(panel.transform, "POKRAČOVAT", Close, 92f, new Color(0.32f, 0.24f, 0.09f, 0.98f));
            AddButton(panel.transform, "ULOŽIT HRU", () => GameManager.Instance.Saves.SaveGame(), 146f);
            AddButton(panel.transform, "NAČÍST HRU", LoadGame, 200f);
            AddButton(panel.transform, "RESPAWN", Respawn, 254f);
            AddButton(panel.transform, "INVENTÁŘ", OpenInventory, 308f);
            AddButton(panel.transform, "MAPA", OpenMap, 362f);
            AddButton(panel.transform, "NASTAVENÍ", OpenSettings, 416f);
            AddButton(panel.transform, "NOVÝ OSTROV", NewGame, 470f);
            AddButton(panel.transform, "UKONČIT", () => Application.Quit(), 524f, new Color(0.36f, 0.11f, 0.09f, 0.98f));
            RuntimeUI.Label(panel.transform, "Version", GameManager.Version, 12, RuntimeUI.Muted, TextAnchor.MiddleCenter,
                new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 18f), new Vector2(-30f, 24f), FontStyle.Bold);
        }

        private static void AddButton(Transform parent, string label, UnityEngine.Events.UnityAction action, float top, Color? color = null)
        {
            RuntimeUI.Button(parent, label, label, () => action(), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                new Vector2(0.5f, 1f), new Vector2(0f, -top), new Vector2(300f, 44f), color, 14);
        }

        private void LoadGame()
        {
            Close();
            GameManager.Instance.Saves.LoadGame();
        }

        private void Respawn()
        {
            Close();
            GameManager.Instance.Respawn();
        }

        private void OpenInventory()
        {
            Close();
            GameManager.Instance.InventoryUI.Toggle();
        }

        private void OpenMap()
        {
            Close();
            GameManager.Instance.MapUI.Open();
        }

        private void OpenSettings()
        {
            Close();
            GameManager.Instance.SettingsUI.Open();
        }

        private void NewGame()
        {
            Close();
            GameManager.Instance.NewGame();
        }
    }
}
