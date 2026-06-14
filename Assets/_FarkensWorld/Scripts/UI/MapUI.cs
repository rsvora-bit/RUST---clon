using UnityEngine;
using UnityEngine.UI;

namespace FarkensWorld
{
    public static class IslandMapGraphic
    {
        private static Texture2D texture;

        public static Texture2D Texture
        {
            get
            {
                if (texture == null)
                {
                    texture = CreateTexture(256);
                }

                return texture;
            }
        }

        private static Texture2D CreateTexture(int size)
        {
            Texture2D map = new Texture2D(size, size, TextureFormat.RGBA32, false)
            {
                name = "Farken's World Island Map",
                filterMode = FilterMode.Bilinear,
                wrapMode = TextureWrapMode.Clamp,
                hideFlags = HideFlags.DontSave
            };

            Color water = new Color(0.055f, 0.39f, 0.58f, 1f);
            Color beach = new Color(0.78f, 0.69f, 0.45f, 1f);
            Color island = new Color(0.22f, 0.45f, 0.21f, 1f);
            Color highland = new Color(0.18f, 0.36f, 0.15f, 1f);
            Color road = new Color(0.15f, 0.17f, 0.19f, 1f);
            Color[] pixels = new Color[size * size];

            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float nx = (x / (float)(size - 1) - 0.5f) * 2f;
                    float ny = (y / (float)(size - 1) - 0.5f) * 2f;
                    float radius = Mathf.Sqrt(nx * nx + ny * ny);
                    Color color = radius < 0.82f ? island : radius < 0.94f ? beach : water;
                    float contour = Mathf.Sin((nx * 7f + ny * 5f) * Mathf.PI) * 0.5f + 0.5f;
                    if (radius < 0.68f && contour > 0.78f)
                    {
                        color = Color.Lerp(color, highland, 0.34f);
                    }

                    if (Mathf.Abs(nx) < 0.055f && Mathf.Abs(ny) < 0.78f)
                    {
                        color = road;
                    }

                    pixels[y * size + x] = color;
                }
            }

            DrawMarker(pixels, size, 0.16f, 0.49f, new Color(0.94f, 0.96f, 0.98f, 1f), 5);
            DrawMarker(pixels, size, 0.08f, -0.24f, new Color(0.35f, 0.74f, 0.91f, 1f), 4);
            map.SetPixels(pixels);
            map.Apply(false, true);
            return map;
        }

        private static void DrawMarker(Color[] pixels, int size, float normalizedX, float normalizedY, Color color, int radius)
        {
            int centerX = Mathf.RoundToInt((normalizedX * 0.5f + 0.5f) * (size - 1));
            int centerY = Mathf.RoundToInt((normalizedY * 0.5f + 0.5f) * (size - 1));
            for (int y = -radius; y <= radius; y++)
            {
                for (int x = -radius; x <= radius; x++)
                {
                    int px = centerX + x;
                    int py = centerY + y;
                    if (px >= 0 && px < size && py >= 0 && py < size && x * x + y * y <= radius * radius)
                    {
                        pixels[py * size + px] = color;
                    }
                }
            }
        }
    }

    public sealed class MapUI : MonoBehaviour
    {
        private GameObject root;
        private RectTransform playerMarker;

        public bool IsOpen { get; private set; }

        private void Start()
        {
            BuildCanvas();
            root.SetActive(false);
        }

        private void Update()
        {
            if (!IsOpen || playerMarker == null || GameManager.Instance.PlayerController == null)
            {
                return;
            }

            Vector3 position = GameManager.Instance.PlayerController.transform.position;
            playerMarker.anchoredPosition = new Vector2(
                Mathf.Clamp(position.x / 75f, -1f, 1f) * 350f,
                Mathf.Clamp(position.z / 75f, -1f, 1f) * 350f);
        }

        public void Toggle()
        {
            if (IsOpen) Close(); else Open();
        }

        public void Open()
        {
            GameManager.Instance.InventoryUI.Close();
            GameManager.Instance.BuildUI.Close();
            IsOpen = true;
            if (root != null) root.SetActive(true);
        }

        public void Close()
        {
            IsOpen = false;
            if (root != null) root.SetActive(false);
        }

        private void BuildCanvas()
        {
            Image overlay = RuntimeUI.Image(RuntimeUI.Canvas.transform, "Map Overlay", new Color(0.018f, 0.028f, 0.036f, 0.96f),
                Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            root = overlay.gameObject;
            Image panel = RuntimeUI.Image(root.transform, "Panel", RuntimeUI.Panel,
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(1280f, 930f));
            RuntimeUI.Label(panel.transform, "Title", "MAPA OSTROVA", 22, RuntimeUI.Accent, TextAnchor.MiddleLeft,
                new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -28f), new Vector2(-170f, 56f), FontStyle.Bold);
            RuntimeUI.Button(panel.transform, "Close", "ZAVŘÍT", Close,
                new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(-16f, -10f), new Vector2(136f, 38f));

            RawImage map = RuntimeUI.Rect(panel.transform, "Map", new Vector2(0f, 1f), new Vector2(0f, 1f),
                new Vector2(0f, 1f), new Vector2(24f, -76f), new Vector2(800f, 800f)).gameObject.AddComponent<RawImage>();
            map.texture = IslandMapGraphic.Texture;
            Image marker = RuntimeUI.Image(map.transform, "Player", new Color(1f, 0.82f, 0.24f, 1f),
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(14f, 14f));
            playerMarker = marker.rectTransform;

            Image legend = RuntimeUI.Image(panel.transform, "Legend", RuntimeUI.PanelSoft,
                new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(-24f, -76f), new Vector2(400f, 800f));
            RuntimeUI.Label(legend.transform, "Title", "LEGENDA", 15, RuntimeUI.Accent, TextAnchor.MiddleLeft,
                new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -12f), new Vector2(-24f, 34f), FontStyle.Bold);
            RuntimeUI.Label(legend.transform, "Items",
                "■  Ostrov\n\n■  Pláž / břeh\n\n■  Voda\n\n■  Silnice\n\n□  Roadside monument\n\n●  Fresh water\n\n●  Hráč",
                15, RuntimeUI.Text, TextAnchor.UpperLeft, new Vector2(0f, 1f), new Vector2(1f, 1f),
                new Vector2(0.5f, 1f), new Vector2(0f, -62f), new Vector2(-40f, 360f), FontStyle.Bold);
            RuntimeUI.Label(legend.transform, "Info",
                "Mapa odpovídá procedurálnímu ostrovu Unity: centrální silnice, monument, sladká voda a pobřežní pás. Žlutá značka ukazuje aktuální pozici hráče.",
                13, RuntimeUI.Muted, TextAnchor.UpperLeft, new Vector2(0f, 0f), new Vector2(1f, 0f),
                new Vector2(0.5f, 0f), new Vector2(0f, 28f), new Vector2(-40f, 190f));
        }
    }
}
