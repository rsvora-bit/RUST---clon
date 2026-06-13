using UnityEngine;

namespace FarkensWorld
{
    public sealed class BuildUI : MonoBehaviour
    {
        public bool IsOpen { get; private set; }

        public void Toggle()
        {
            IsOpen = !IsOpen;
            if (IsOpen) GameManager.Instance.InventoryUI.Close();
        }

        public void Close()
        {
            IsOpen = false;
        }

        private void OnGUI()
        {
            if (!IsOpen) return;
            float width = 430f;
            float x = Screen.width * 0.5f - width * 0.5f;
            GUI.Box(new Rect(x, 70f, width, 560f), GUIContent.none);
            GUI.Label(new Rect(x + 20f, 86f, width - 40f, 30f), "BUILDING PLAN", HeaderStyle());

            for (int i = 0; i < BuildPieceDatabase.All.Count; i++)
            {
                BuildPieceDefinition definition = BuildPieceDatabase.All[i];
                string label = definition.DisplayName + "\n" + CostText(definition);
                if (GUI.Button(new Rect(x + 20f, 128f + i * 45f, width - 40f, 38f), label))
                {
                    GameManager.Instance.Building.BeginPlacement(definition.Type);
                }
            }

            GUI.Label(new Rect(x + 20f, 540f, width - 40f, 70f), "LMB place | RMB cancel | R rotate\nU upgrade | T repair | X demolish", CenterStyle());
        }

        private static string CostText(BuildPieceDefinition definition)
        {
            foreach (System.Collections.Generic.KeyValuePair<string, int> cost in definition.Cost)
            {
                return cost.Key + " x" + cost.Value;
            }
            return string.Empty;
        }

        private static GUIStyle HeaderStyle()
        {
            GUIStyle style = new GUIStyle(GUI.skin.label) { fontSize = 20, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter };
            style.normal.textColor = new Color(0.95f, 0.77f, 0.28f);
            return style;
        }

        private static GUIStyle CenterStyle()
        {
            return new GUIStyle(GUI.skin.label) { alignment = TextAnchor.MiddleCenter, fontSize = 13 };
        }
    }
}
