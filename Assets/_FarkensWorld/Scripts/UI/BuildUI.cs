using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace FarkensWorld
{
    public sealed class BuildUI : MonoBehaviour
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
            if (IsOpen)
            {
                GameManager.Instance.InventoryUI.Close();
                GameManager.Instance.MapUI.Close();
            }

            if (root != null)
            {
                root.SetActive(IsOpen);
            }
        }

        public void Close()
        {
            IsOpen = false;
            if (root != null)
            {
                root.SetActive(false);
            }
        }

        private void BuildCanvas()
        {
            Image overlay = RuntimeUI.Image(RuntimeUI.Canvas.transform, "Build Overlay", new Color(0.018f, 0.028f, 0.036f, 0.94f),
                Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            root = overlay.gameObject;
            Image panel = RuntimeUI.Image(root.transform, "Panel", RuntimeUI.Panel,
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(980f, 760f));
            RuntimeUI.Image(panel.transform, "Header", new Color(0.16f, 0.12f, 0.045f, 0.62f),
                new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), Vector2.zero, new Vector2(0f, 58f));
            RuntimeUI.Label(panel.transform, "Title", "BUILD MENU", 21, RuntimeUI.Accent, TextAnchor.MiddleLeft,
                new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -29f), new Vector2(-180f, 58f), FontStyle.Bold);
            RuntimeUI.Button(panel.transform, "Close", "ZAVŘÍT", Close,
                new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(-16f, -10f), new Vector2(136f, 38f));

            for (int i = 0; i < BuildPieceDatabase.All.Count; i++)
            {
                BuildPieceDefinition definition = BuildPieceDatabase.All[i];
                int row = i / 3;
                int column = i % 3;
                string label = "BUILD\n" + definition.DisplayName + "\n" + CostText(definition) + "\n" + SizeText(definition.Size);
                RuntimeUI.Button(panel.transform, "Build " + definition.Type, label,
                    () => GameManager.Instance.Building.BeginPlacement(definition.Type),
                    new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f),
                    new Vector2(22f + column * 314f, -86f - row * 142f), new Vector2(294f, 126f),
                    new Color(0.22f, 0.16f, 0.09f, 0.96f), 13);
            }

            RuntimeUI.Label(panel.transform, "Help", "LPM položit | RMB zrušit | R otočit | U upgrade | T repair | X demolish",
                13, RuntimeUI.Muted, TextAnchor.MiddleCenter, new Vector2(0f, 0f), new Vector2(1f, 0f),
                new Vector2(0.5f, 0f), new Vector2(0f, 18f), new Vector2(-40f, 34f), FontStyle.Bold);
        }

        private static string CostText(BuildPieceDefinition definition)
        {
            List<string> costs = new List<string>();
            foreach (KeyValuePair<string, int> cost in definition.Cost)
            {
                costs.Add(cost.Key + " x" + cost.Value);
            }

            return string.Join(" | ", costs);
        }

        private static string SizeText(Vector3 size)
        {
            return size.x.ToString("0.0") + " x " + size.z.ToString("0.0");
        }
    }
}
