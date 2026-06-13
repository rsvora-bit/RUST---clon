using UnityEngine;

namespace FarkensWorld
{
    public sealed class PauseMenuUI : MonoBehaviour
    {
        public bool IsOpen { get; private set; }

        public void Toggle()
        {
            IsOpen = !IsOpen;
            Time.timeScale = IsOpen ? 0f : 1f;
        }

        public void Close()
        {
            if (!IsOpen) return;
            IsOpen = false;
            Time.timeScale = 1f;
        }

        private void OnGUI()
        {
            if (!IsOpen) return;
            float x = Screen.width * 0.5f - 170f;
            float y = Screen.height * 0.5f - 190f;
            GUI.Box(new Rect(x, y, 340f, 380f), GUIContent.none);
            GUI.Label(new Rect(x + 20f, y + 20f, 300f, 40f), "FARKEN'S WORLD - PAUSED", HeaderStyle());
            if (GUI.Button(new Rect(x + 55f, y + 78f, 230f, 42f), "Resume")) Close();
            if (GUI.Button(new Rect(x + 55f, y + 130f, 230f, 42f), "Save Game")) GameManager.Instance.Saves.SaveGame();
            if (GUI.Button(new Rect(x + 55f, y + 182f, 230f, 42f), "Load Game")) { Close(); GameManager.Instance.Saves.LoadGame(); }
            if (GUI.Button(new Rect(x + 55f, y + 234f, 230f, 42f), "New Game")) { Close(); GameManager.Instance.NewGame(); }
            if (GUI.Button(new Rect(x + 55f, y + 286f, 230f, 42f), "Quit")) Application.Quit();
            GUI.Label(new Rect(x + 20f, y + 342f, 300f, 24f), GameManager.Version, HeaderStyle());
        }

        private static GUIStyle HeaderStyle()
        {
            GUIStyle style = new GUIStyle(GUI.skin.label) { fontSize = 18, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter };
            style.normal.textColor = new Color(0.95f, 0.77f, 0.28f);
            return style;
        }
    }
}
