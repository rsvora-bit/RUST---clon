using UnityEngine;
using UnityEngine.UI;

namespace FarkensWorld
{
    public sealed class DeathUI : MonoBehaviour
    {
        private GameObject root;
        private Text reasonText;

        public bool IsOpen { get; private set; }

        private void Start()
        {
            BuildCanvas();
            root.SetActive(false);
        }

        public void Show(string reason)
        {
            IsOpen = true;
            if (root != null)
            {
                root.SetActive(true);
                reasonText.text = string.IsNullOrWhiteSpace(reason) ? "Ostrov si tě vzal zpátky." : reason;
            }

            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
        }

        public void Close()
        {
            IsOpen = false;
            if (root != null) root.SetActive(false);
        }

        private void BuildCanvas()
        {
            Image overlay = RuntimeUI.Image(RuntimeUI.Canvas.transform, "Death Overlay", new Color(0.05f, 0.008f, 0.008f, 0.9f),
                Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            root = overlay.gameObject;
            Image panel = RuntimeUI.Image(root.transform, "Death Panel", new Color(0.045f, 0.035f, 0.035f, 0.98f),
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(560f, 340f));
            RuntimeUI.Label(panel.transform, "Title", "ZEMŘEL JSI", 38, new Color(0.95f, 0.28f, 0.22f, 1f), TextAnchor.MiddleCenter,
                new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -36f), new Vector2(-40f, 70f), FontStyle.Bold);
            reasonText = RuntimeUI.Label(panel.transform, "Reason", "Ostrov si tě vzal zpátky.", 17, RuntimeUI.Text, TextAnchor.MiddleCenter,
                new Vector2(0f, 0.5f), new Vector2(1f, 1f), new Vector2(0.5f, 0.5f), new Vector2(0f, -28f), new Vector2(-70f, 100f));
            RuntimeUI.Button(panel.transform, "Respawn", "RESPAWN", () => GameManager.Instance.Respawn(),
                new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 80f), new Vector2(300f, 48f),
                new Color(0.3f, 0.23f, 0.08f, 0.98f), 15);
            RuntimeUI.Button(panel.transform, "New Island", "NOVÝ OSTROV", () => GameManager.Instance.NewGame(),
                new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 24f), new Vector2(300f, 42f), RuntimeUI.PanelSoft, 13);
        }
    }
}
