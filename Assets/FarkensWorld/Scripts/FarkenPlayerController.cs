using UnityEngine;
using UnityEngine.InputSystem;

namespace FarkensWorld
{
    [RequireComponent(typeof(CharacterController))]
    public sealed class FarkenPlayerController : MonoBehaviour
    {
        private const float Gravity = -24f;

        [SerializeField] private float walkSpeed = 5.5f;
        [SerializeField] private float sprintSpeed = 8.5f;
        [SerializeField] private float jumpHeight = 1.25f;
        [SerializeField] private float mouseSensitivity = 0.12f;
        [SerializeField] private float interactDistance = 4.5f;

        private CharacterController characterController;
        private Camera playerCamera;
        private float pitch;
        private float verticalVelocity;
        private string message = string.Empty;
        private float messageUntil;

        public int Wood { get; private set; }
        public int Stone { get; private set; }
        public float Health { get; set; } = 100f;
        public float Hunger { get; set; } = 100f;
        public float Thirst { get; set; } = 100f;
        public string LookPrompt { get; private set; } = string.Empty;
        public string Message => Time.time < messageUntil ? message : string.Empty;

        private void Awake()
        {
            characterController = GetComponent<CharacterController>();
            CreateCamera();
            LockCursor(true);
        }

        private void Update()
        {
            Keyboard keyboard = Keyboard.current;
            Mouse mouse = Mouse.current;

            if (keyboard == null)
            {
                return;
            }

            if (keyboard.escapeKey.wasPressedThisFrame)
            {
                LockCursor(false);
            }
            else if (mouse != null && mouse.leftButton.wasPressedThisFrame && Cursor.lockState != CursorLockMode.Locked)
            {
                LockCursor(true);
            }

            if (Cursor.lockState == CursorLockMode.Locked && mouse != null)
            {
                UpdateLook(mouse.delta.ReadValue());
            }

            UpdateMovement(keyboard);
            UpdateTargetPrompt();

            if (keyboard.eKey.wasPressedThisFrame)
            {
                TryHarvest();
            }
        }

        public void AddWood(int amount)
        {
            Wood += Mathf.Max(0, amount);
        }

        public void AddStone(int amount)
        {
            Stone += Mathf.Max(0, amount);
        }

        public void ShowMessage(string text)
        {
            message = text;
            messageUntil = Time.time + 2.2f;
        }

        private void CreateCamera()
        {
            GameObject cameraObject = new GameObject("Player Camera");
            cameraObject.transform.SetParent(transform, false);
            cameraObject.transform.localPosition = new Vector3(0f, 1.62f, 0f);
            playerCamera = cameraObject.AddComponent<Camera>();
            playerCamera.fieldOfView = 72f;
            playerCamera.nearClipPlane = 0.05f;
            playerCamera.farClipPlane = 500f;
            cameraObject.AddComponent<AudioListener>();
        }

        private void UpdateLook(Vector2 mouseDelta)
        {
            float yaw = mouseDelta.x * mouseSensitivity;
            float pitchDelta = mouseDelta.y * mouseSensitivity;

            transform.Rotate(Vector3.up, yaw, Space.Self);
            pitch = Mathf.Clamp(pitch - pitchDelta, -85f, 85f);
            playerCamera.transform.localRotation = Quaternion.Euler(pitch, 0f, 0f);
        }

        private void UpdateMovement(Keyboard keyboard)
        {
            Vector2 input = Vector2.zero;
            input.x = (keyboard.dKey.isPressed ? 1f : 0f) - (keyboard.aKey.isPressed ? 1f : 0f);
            input.y = (keyboard.wKey.isPressed ? 1f : 0f) - (keyboard.sKey.isPressed ? 1f : 0f);
            input = Vector2.ClampMagnitude(input, 1f);

            bool sprinting = keyboard.leftShiftKey.isPressed && input.y > 0f;
            float speed = sprinting ? sprintSpeed : walkSpeed;
            Vector3 planarMovement = (transform.right * input.x + transform.forward * input.y) * speed;

            if (characterController.isGrounded && verticalVelocity < 0f)
            {
                verticalVelocity = -2f;
            }

            if (characterController.isGrounded && keyboard.spaceKey.wasPressedThisFrame)
            {
                verticalVelocity = Mathf.Sqrt(jumpHeight * -2f * Gravity);
            }

            verticalVelocity += Gravity * Time.deltaTime;
            Vector3 velocity = planarMovement + Vector3.up * verticalVelocity;
            characterController.Move(velocity * Time.deltaTime);
        }

        private void UpdateTargetPrompt()
        {
            LookPrompt = string.Empty;

            if (Physics.Raycast(playerCamera.transform.position, playerCamera.transform.forward, out RaycastHit hit, interactDistance))
            {
                FarkenResourceNode node = hit.collider.GetComponentInParent<FarkenResourceNode>();
                if (node != null)
                {
                    LookPrompt = node.Prompt;
                }
            }
        }

        private void TryHarvest()
        {
            if (!Physics.Raycast(playerCamera.transform.position, playerCamera.transform.forward, out RaycastHit hit, interactDistance))
            {
                return;
            }

            FarkenResourceNode node = hit.collider.GetComponentInParent<FarkenResourceNode>();
            if (node != null)
            {
                node.Harvest(this);
            }
        }

        private static void LockCursor(bool locked)
        {
            Cursor.lockState = locked ? CursorLockMode.Locked : CursorLockMode.None;
            Cursor.visible = !locked;
        }
    }
}
