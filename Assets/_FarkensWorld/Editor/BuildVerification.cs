using System;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace FarkensWorld.Editor
{
    public static class BuildVerification
    {
        public static void BuildMacSmoke()
        {
            string outputPath = Environment.GetEnvironmentVariable("FARKENS_SMOKE_OUTPUT");
            if (string.IsNullOrWhiteSpace(outputPath)) outputPath = "/tmp/FarkensWorldSmoke.app";
            BuildPlayerOptions options = new BuildPlayerOptions
            {
                scenes = new[] { "Assets/_FarkensWorld/Scenes/Main.unity" },
                locationPathName = outputPath,
                target = BuildTarget.StandaloneOSX,
                options = BuildOptions.Development
            };
            BuildReport report = BuildPipeline.BuildPlayer(options);
            if (report.summary.result != BuildResult.Succeeded)
            {
                throw new InvalidOperationException("Farken's World smoke build failed: " + report.summary.result);
            }

            Debug.Log("[FARKENS_BUILD] PASS | " + outputPath + " | " + report.summary.totalSize + " bytes");
        }
    }
}
