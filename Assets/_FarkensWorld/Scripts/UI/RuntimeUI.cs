using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;

namespace FarkensWorld
{
    public static class RuntimeUI
    {
        public static readonly Color Panel = new Color(0.035f, 0.051f, 0.067f, 0.93f);
        public static readonly Color PanelSoft = new Color(0.063f, 0.09f, 0.114f, 0.94f);
        public static readonly Color Slot = new Color(0.105f, 0.125f, 0.13f, 0.94f);
        public static readonly Color SlotEmpty = new Color(0.045f, 0.06f, 0.071f, 0.84f);
        public static readonly Color Line = new Color(0.91f, 0.95f, 0.98f, 0.14f);
        public static readonly Color LineStrong = new Color(0.91f, 0.95f, 0.98f, 0.28f);
        public static readonly Color Text = new Color(0.933f, 0.961f, 0.973f, 1f);
        public static readonly Color Muted = new Color(0.66f, 0.71f, 0.74f, 1f);
        public static readonly Color Accent = new Color(0.839f, 0.635f, 0.227f, 1f);
        public static readonly Color AccentBlue = new Color(0.349f, 0.741f, 0.91f, 1f);
        public static readonly Color Danger = new Color(0.894f, 0.329f, 0.259f, 1f);
        public static readonly Color Ok = new Color(0.49f, 0.8f, 0.408f, 1f);

        private static Canvas canvas;
        private static Font font;

        public static Canvas Canvas
        {
            get
            {
                EnsureCanvas();
                return canvas;
            }
        }

        public static Font Font
        {
            get
            {
                if (font == null)
                {
                    font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
                }

                return font;
            }
        }

        public static void EnsureCanvas()
        {
            if (canvas != null)
            {
                return;
            }

            GameObject canvasObject = new GameObject("Farken's World UI", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvas = canvasObject.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 20;

            CanvasScaler scaler = canvasObject.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920f, 1080f);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 0.5f;

            if (UnityEngine.Object.FindAnyObjectByType<EventSystem>() == null)
            {
                GameObject eventSystem = new GameObject("Farken's World Event System", typeof(EventSystem), typeof(InputSystemUIInputModule));
                UnityEngine.Object.DontDestroyOnLoad(eventSystem);
            }

            UnityEngine.Object.DontDestroyOnLoad(canvasObject);
        }

        public static RectTransform Rect(
            Transform parent,
            string name,
            Vector2 anchorMin,
            Vector2 anchorMax,
            Vector2 pivot,
            Vector2 position,
            Vector2 size)
        {
            GameObject gameObject = new GameObject(name, typeof(RectTransform));
            RectTransform rect = gameObject.GetComponent<RectTransform>();
            rect.SetParent(parent, false);
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.pivot = pivot;
            rect.anchoredPosition = position;
            rect.sizeDelta = size;
            rect.localScale = Vector3.one;
            return rect;
        }

        public static Image Image(
            Transform parent,
            string name,
            Color color,
            Vector2 anchorMin,
            Vector2 anchorMax,
            Vector2 pivot,
            Vector2 position,
            Vector2 size)
        {
            RectTransform rect = Rect(parent, name, anchorMin, anchorMax, pivot, position, size);
            Image image = rect.gameObject.AddComponent<Image>();
            image.color = color;
            return image;
        }

        public static Text Label(
            Transform parent,
            string name,
            string value,
            int fontSize,
            Color color,
            TextAnchor alignment,
            Vector2 anchorMin,
            Vector2 anchorMax,
            Vector2 pivot,
            Vector2 position,
            Vector2 size,
            FontStyle style = FontStyle.Normal)
        {
            RectTransform rect = Rect(parent, name, anchorMin, anchorMax, pivot, position, size);
            Text text = rect.gameObject.AddComponent<Text>();
            text.font = Font;
            text.fontSize = fontSize;
            text.fontStyle = style;
            text.color = color;
            text.alignment = alignment;
            text.horizontalOverflow = HorizontalWrapMode.Wrap;
            text.verticalOverflow = VerticalWrapMode.Truncate;
            text.raycastTarget = false;
            text.text = value;
            return text;
        }

        public static Button Button(
            Transform parent,
            string name,
            string value,
            Action clicked,
            Vector2 anchorMin,
            Vector2 anchorMax,
            Vector2 pivot,
            Vector2 position,
            Vector2 size,
            Color? background = null,
            int fontSize = 13)
        {
            Image image = Image(parent, name, background ?? PanelSoft, anchorMin, anchorMax, pivot, position, size);
            Button button = image.gameObject.AddComponent<Button>();
            ColorBlock colors = button.colors;
            colors.normalColor = Color.white;
            colors.highlightedColor = new Color(1.08f, 1.08f, 1.08f, 1f);
            colors.pressedColor = new Color(0.82f, 0.82f, 0.82f, 1f);
            colors.disabledColor = new Color(0.42f, 0.42f, 0.42f, 0.7f);
            button.colors = colors;
            if (clicked != null)
            {
                button.onClick.AddListener(() => clicked());
            }

            Label(button.transform, "Label", value, fontSize, Text, TextAnchor.MiddleCenter,
                Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero, FontStyle.Bold);
            return button;
        }

        public static InputField Input(
            Transform parent,
            string name,
            string placeholder,
            Vector2 anchorMin,
            Vector2 anchorMax,
            Vector2 pivot,
            Vector2 position,
            Vector2 size)
        {
            Image background = Image(parent, name, new Color(0f, 0f, 0f, 0.52f), anchorMin, anchorMax, pivot, position, size);
            InputField field = background.gameObject.AddComponent<InputField>();
            Text value = Label(field.transform, "Text", string.Empty, 14, Text, TextAnchor.MiddleLeft,
                Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), new Vector2(8f, 0f), new Vector2(-16f, 0f));
            Text hint = Label(field.transform, "Placeholder", placeholder, 13, Muted, TextAnchor.MiddleLeft,
                Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), new Vector2(8f, 0f), new Vector2(-16f, 0f));
            field.textComponent = value;
            field.placeholder = hint;
            field.lineType = InputField.LineType.SingleLine;
            return field;
        }

        public static Slider Slider(
            Transform parent,
            string name,
            float minimum,
            float maximum,
            float value,
            Action<float> changed,
            Vector2 anchorMin,
            Vector2 anchorMax,
            Vector2 pivot,
            Vector2 position,
            Vector2 size)
        {
            Image background = Image(parent, name, new Color(0.055f, 0.071f, 0.082f, 0.98f),
                anchorMin, anchorMax, pivot, position, size);
            Slider slider = background.gameObject.AddComponent<Slider>();
            slider.minValue = minimum;
            slider.maxValue = maximum;
            slider.value = value;
            slider.direction = UnityEngine.UI.Slider.Direction.LeftToRight;

            Image fill = Image(background.transform, "Fill", AccentBlue, Vector2.zero, new Vector2(0f, 1f),
                new Vector2(0f, 0.5f), new Vector2(3f, 0f), new Vector2(-6f, -6f));
            fill.rectTransform.anchorMax = new Vector2(0f, 1f);
            slider.fillRect = fill.rectTransform;

            Image handle = Image(background.transform, "Handle", Accent, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f),
                new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(16f, size.y + 4f));
            slider.handleRect = handle.rectTransform;
            slider.targetGraphic = handle;
            if (changed != null)
            {
                slider.onValueChanged.AddListener(valueChanged => changed(valueChanged));
            }

            return slider;
        }

        public static void SetButtonText(Button button, string value)
        {
            Text label = button == null ? null : button.GetComponentInChildren<Text>();
            if (label != null)
            {
                label.text = value;
            }
        }

        public static void SetImageColor(Graphic graphic, Color color)
        {
            if (graphic != null)
            {
                graphic.color = color;
            }
        }

        public static string CategoryName(ItemCategory category)
        {
            switch (category)
            {
                case ItemCategory.Resources: return "RESOURCES";
                case ItemCategory.Components: return "COMPONENTS";
                case ItemCategory.Tools: return "TOOLS";
                case ItemCategory.Weapons: return "WEAPONS";
                case ItemCategory.Food: return "FOOD";
                case ItemCategory.Medical: return "MEDICAL";
                case ItemCategory.Build: return "BUILD";
                default: return "ITEM";
            }
        }

        public static Color CategoryColor(ItemCategory category)
        {
            switch (category)
            {
                case ItemCategory.Resources: return new Color(0.22f, 0.36f, 0.2f, 0.96f);
                case ItemCategory.Components: return new Color(0.16f, 0.31f, 0.39f, 0.96f);
                case ItemCategory.Tools:
                case ItemCategory.Weapons: return new Color(0.32f, 0.27f, 0.13f, 0.96f);
                case ItemCategory.Food: return new Color(0.33f, 0.21f, 0.1f, 0.96f);
                case ItemCategory.Medical: return new Color(0.36f, 0.13f, 0.12f, 0.96f);
                case ItemCategory.Build: return new Color(0.31f, 0.23f, 0.14f, 0.96f);
                default: return Slot;
            }
        }
    }
}
