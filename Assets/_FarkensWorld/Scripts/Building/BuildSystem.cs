using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;

namespace FarkensWorld
{
    public sealed class BuildSystem : MonoBehaviour
    {
        private readonly List<BuildPiece> placedPieces = new List<BuildPiece>();
        private BuildPieceDefinition selected;
        private GameObject preview;
        private Material previewValid;
        private Material previewInvalid;
        private float rotation;
        private bool canPlace;

        public bool IsPlacing => selected != null && preview != null;
        public IReadOnlyList<BuildPiece> PlacedPieces => placedPieces;
        public BuildPieceDefinition Selected => selected;

        private void Awake()
        {
            previewValid = WorldGenerator.CreateMaterial("Build Preview Valid", new Color(0.14f, 0.8f, 0.3f, 0.55f), 0.6f);
            previewInvalid = WorldGenerator.CreateMaterial("Build Preview Invalid", new Color(0.9f, 0.16f, 0.12f, 0.55f), 0.6f);
        }

        private void Update()
        {
            if (GameManager.Instance.GameplayInputBlocked)
            {
                return;
            }

            Keyboard keyboard = Keyboard.current;
            Mouse mouse = Mouse.current;
            if (keyboard == null || mouse == null)
            {
                return;
            }

            if (keyboard.uKey.wasPressedThisFrame) UpgradeTarget();
            if (keyboard.tKey.wasPressedThisFrame) RepairTarget();
            if (keyboard.xKey.wasPressedThisFrame) DemolishTarget();

            if (!IsPlacing)
            {
                return;
            }

            if (keyboard.rKey.wasPressedThisFrame)
            {
                rotation += 90f;
            }

            UpdatePreview();

            if (mouse.leftButton.wasPressedThisFrame && canPlace)
            {
                PlaceSelected(true);
            }

            if (mouse.rightButton.wasPressedThisFrame)
            {
                CancelPlacement();
            }

        }

        public void BeginPlacement(BuildPieceType type)
        {
            CancelPlacement();
            selected = BuildPieceDatabase.Get(type);
            if (selected == null)
            {
                return;
            }

            preview = GameObject.CreatePrimitive(PrimitiveType.Cube);
            preview.name = "Build Preview - " + selected.Type;
            preview.transform.localScale = selected.Size;
            Destroy(preview.GetComponent<Collider>());
            preview.GetComponent<Renderer>().sharedMaterial = previewValid;
            GameManager.Instance.BuildUI.Close();
        }

        public void CancelPlacement()
        {
            selected = null;
            if (preview != null)
            {
                Destroy(preview);
            }
        }

        public int GetNearbyWorkbenchLevel()
        {
            if (GameManager.Instance == null || GameManager.Instance.PlayerController == null)
            {
                return 0;
            }

            Vector3 playerPosition = GameManager.Instance.PlayerController.transform.position;
            int level = 0;
            for (int i = 0; i < placedPieces.Count; i++)
            {
                BuildPiece piece = placedPieces[i];
                if (piece == null || Vector3.Distance(playerPosition, piece.transform.position) > 13f)
                {
                    continue;
                }

                if (piece.Type == BuildPieceType.Workbench) level = Mathf.Max(level, 1);
                if (piece.Type == BuildPieceType.Workbench2) level = Mathf.Max(level, 2);
                if (piece.Type == BuildPieceType.Workbench3) level = Mathf.Max(level, 3);
            }

            return level;
        }

        public BuildPiece CreatePlacedPiece(BuildPieceType type, Vector3 position, Quaternion rotationValue, bool register = true)
        {
            BuildPieceDefinition definition = BuildPieceDatabase.Get(type);
            GameObject root = new GameObject("Build - " + type);
            root.transform.position = position;
            root.transform.rotation = rotationValue;
            Material material = WorldGenerator.CreateMaterial("Wood Build", new Color(0.42f, 0.23f, 0.08f), 0.9f);

            if (type == BuildPieceType.Doorframe)
            {
                WorldGenerator.Primitive("Left", PrimitiveType.Cube, new Vector3(-2.15f, 1.6f, 0f), new Vector3(1.7f, 3.2f, 0.35f), material, root.transform);
                WorldGenerator.Primitive("Right", PrimitiveType.Cube, new Vector3(2.15f, 1.6f, 0f), new Vector3(1.7f, 3.2f, 0.35f), material, root.transform);
                WorldGenerator.Primitive("Top", PrimitiveType.Cube, new Vector3(0f, 2.85f, 0f), new Vector3(2.6f, 0.7f, 0.35f), material, root.transform);
            }
            else
            {
                PrimitiveType primitiveType = type == BuildPieceType.Furnace ? PrimitiveType.Cylinder : PrimitiveType.Cube;
                WorldGenerator.Primitive("Body", primitiveType, new Vector3(0f, definition.Size.y * 0.5f, 0f), definition.Size, material, root.transform);
            }

            BuildPiece piece = root.AddComponent<BuildPiece>();
            piece.Initialize(type);
            if (type == BuildPieceType.StorageBox)
            {
                ContainerInventory container = root.AddComponent<ContainerInventory>();
                container.Configure("Storage Box", 12);
            }
            else if (type == BuildPieceType.Furnace)
            {
                root.AddComponent<Furnace>();
            }

            if (register)
            {
                placedPieces.Add(piece);
            }

            return piece;
        }

        public void ClearAll()
        {
            for (int i = 0; i < placedPieces.Count; i++)
            {
                if (placedPieces[i] != null)
                {
                    Destroy(placedPieces[i].gameObject);
                }
            }

            placedPieces.Clear();
            CancelPlacement();
        }

        public void RemoveMissingReferences()
        {
            placedPieces.RemoveAll(piece => piece == null);
        }

        private void UpdatePreview()
        {
            Camera camera = GameManager.Instance.PlayerController.PlayerCamera;
            RaycastHit hit;
            if (!Physics.Raycast(camera.transform.position, camera.transform.forward, out hit, 10f))
            {
                preview.SetActive(false);
                canPlace = false;
                return;
            }

            preview.SetActive(true);
            Vector3 position = hit.point;
            Quaternion previewRotation = Quaternion.Euler(0f, rotation, 0f);
            bool snapRequired = selected.Type == BuildPieceType.Wall || selected.Type == BuildPieceType.Doorframe || selected.Type == BuildPieceType.Roof;
            BuildPiece foundation = FindNearestFoundation(position, 8f);

            if (selected.Type == BuildPieceType.Foundation)
            {
                position.x = Mathf.Round(position.x / 6f) * 6f;
                position.z = Mathf.Round(position.z / 6f) * 6f;
                position.y = 0.22f;
            }
            else if (snapRequired && foundation != null)
            {
                if (selected.Type == BuildPieceType.Roof)
                {
                    position = foundation.transform.position + Vector3.up * 3.35f;
                    previewRotation = foundation.transform.rotation;
                }
                else
                {
                    Vector3 local = foundation.transform.InverseTransformPoint(position);
                    bool xEdge = Mathf.Abs(local.x) > Mathf.Abs(local.z);
                    local = xEdge
                        ? new Vector3(Mathf.Sign(local.x) * 3f, 1.6f, 0f)
                        : new Vector3(0f, 1.6f, Mathf.Sign(local.z) * 3f);
                    position = foundation.transform.TransformPoint(local);
                    previewRotation = foundation.transform.rotation * Quaternion.Euler(0f, xEdge ? 90f : 0f, 0f);
                }
            }
            else
            {
                position.y += selected.Size.y * 0.5f;
            }

            preview.transform.SetPositionAndRotation(position, previewRotation);
            canPlace = !snapRequired || foundation != null;
            preview.GetComponent<Renderer>().sharedMaterial = canPlace ? previewValid : previewInvalid;
        }

        private void PlaceSelected(bool payCost)
        {
            if (payCost && !PayCost(selected.Cost))
            {
                GameEvents.RaiseCenter("Missing build resources");
                return;
            }

            Vector3 position = preview.transform.position;
            if (selected.Type != BuildPieceType.Foundation && selected.Type != BuildPieceType.Wall && selected.Type != BuildPieceType.Doorframe && selected.Type != BuildPieceType.Roof)
            {
                position.y -= selected.Size.y * 0.5f;
            }

            CreatePlacedPiece(selected.Type, position, preview.transform.rotation);
            GameEvents.RaiseCenter("Placed " + selected.DisplayName);
            GameManager.Instance.Audio.Play(AudioCue.Build, Random.Range(0.92f, 1.06f));
        }

        private bool PayCost(IReadOnlyDictionary<string, int> cost)
        {
            Inventory inventory = GameManager.Instance.PlayerInventory;
            foreach (KeyValuePair<string, int> entry in cost)
            {
                if (inventory.Count(entry.Key) < entry.Value)
                {
                    return false;
                }
            }

            foreach (KeyValuePair<string, int> entry in cost)
            {
                inventory.Remove(entry.Key, entry.Value);
            }

            return true;
        }

        private BuildPiece FindNearestFoundation(Vector3 position, float maxDistance)
        {
            BuildPiece nearest = null;
            float best = maxDistance;
            for (int i = 0; i < placedPieces.Count; i++)
            {
                BuildPiece piece = placedPieces[i];
                if (piece == null || piece.Type != BuildPieceType.Foundation)
                {
                    continue;
                }

                float distance = Vector3.Distance(position, piece.transform.position);
                if (distance < best)
                {
                    best = distance;
                    nearest = piece;
                }
            }

            return nearest;
        }

        private BuildPiece GetTargetPiece()
        {
            Camera camera = GameManager.Instance.PlayerController.PlayerCamera;
            RaycastHit hit;
            return Physics.Raycast(camera.transform.position, camera.transform.forward, out hit, 6f)
                ? hit.collider.GetComponentInParent<BuildPiece>()
                : null;
        }

        private void UpgradeTarget()
        {
            BuildPiece target = GetTargetPiece();
            GameEvents.RaiseCenter(target != null && target.Upgrade() ? "Build upgraded" : "Cannot upgrade target");
        }

        private void RepairTarget()
        {
            BuildPiece target = GetTargetPiece();
            GameEvents.RaiseCenter(target != null && target.Repair() ? "Build repaired" : "Cannot repair target");
        }

        private void DemolishTarget()
        {
            BuildPiece target = GetTargetPiece();
            if (target == null || GameManager.Instance.PlayerInventory.Count("buildingPlan") <= 0)
            {
                GameEvents.RaiseCenter("Building plan and valid target required");
                return;
            }

            ContainerInventory container = target.GetComponent<ContainerInventory>();
            if (container != null)
            {
                container.DropContents();
            }

            BuildPieceDefinition definition = BuildPieceDatabase.Get(target.Type);
            foreach (KeyValuePair<string, int> entry in definition.Cost)
            {
                if (ItemDatabase.Contains(entry.Key))
                {
                    GameManager.Instance.PlayerInventory.Add(entry.Key, Mathf.Max(1, entry.Value / 2));
                }
            }

            placedPieces.Remove(target);
            Destroy(target.gameObject);
            GameEvents.RaiseCenter("Build demolished");
        }
    }
}
