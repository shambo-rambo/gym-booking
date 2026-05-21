starting build "976064e0-c3f2-4a27-b925-9cd7e1a6b80e"
FETCHSOURCE
From https://github.com/shambo-rambo/gym-booking
 * branch            6bafefcc034b41d36fcfabe70f073087fc8f82d0 -> FETCH_HEAD
HEAD is now at 6bafefc Parallelize booking validations and minimize transaction duration to fix timeouts
GitCommit:
6bafefcc034b41d36fcfabe70f073087fc8f82d0
BUILD
Starting Step #0 - "ubuntu"
Already have image (with digest): gcr.io/cloud-builders/gcloud
Finished Step #0 - "ubuntu"
Starting Step #1 - "preparer"
Pulling image: asia-southeast1-docker.pkg.dev/serverless-runtimes/utilities/preparer:base_20260409_18_04_RC00
base_20260409_18_04_RC00: Pulling from serverless-runtimes/utilities/preparer
5014a0af1d5d: Pulling fs layer
5014a0af1d5d: Download complete
5014a0af1d5d: Pull complete
Digest: sha256:a36e57c7c57abad3310796bc58c9672e5018a27c9c952f69ba3c5fa2c0d6cdea
Status: Downloaded newer image for asia-southeast1-docker.pkg.dev/serverless-runtimes/utilities/preparer:base_20260409_18_04_RC00
asia-southeast1-docker.pkg.dev/serverless-runtimes/utilities/preparer:base_20260409_18_04_RC00
2026/05/21 05:39:59 FIREBASE_CONFIG has no availability specified, applying the default of 'BUILD' and 'RUNTIME'
2026/05/21 05:40:00 Pinned secret projects/watertower-gym/secrets/DATABASE_URL/versions/latest to projects/786570689136/secrets/DATABASE_URL/versions/3 for the rest of the current build and run
2026/05/21 05:40:00 Pinned secret projects/watertower-gym/secrets/DIRECT_URL/versions/latest to projects/786570689136/secrets/DIRECT_URL/versions/1 for the rest of the current build and run
2026/05/21 05:40:00 Pinned secret projects/watertower-gym/secrets/AUTH_SECRET/versions/latest to projects/786570689136/secrets/AUTH_SECRET/versions/1 for the rest of the current build and run
2026/05/21 05:40:00 Pinned secret projects/watertower-gym/secrets/RESEND_API_KEY/versions/latest to projects/786570689136/secrets/RESEND_API_KEY/versions/1 for the rest of the current build and run
2026/05/21 05:40:01 Pinned secret projects/watertower-gym/secrets/BUILDING_CODE/versions/latest to projects/786570689136/secrets/BUILDING_CODE/versions/1 for the rest of the current build and run
2026/05/21 05:40:01 Pinned secret projects/watertower-gym/secrets/CRON_SECRET/versions/latest to projects/786570689136/secrets/CRON_SECRET/versions/1 for the rest of the current build and run
--------------------------------------------------------------------------------
{"reason":"Misconfigured Secret","code":"fah/misconfigured-secret","userFacingMessage":"Error resolving secret version with name=projects/watertower-gym/secrets/GOOGLE_CLIENT_ID/versions/latest. Please ensure the secret exists in your project and that your App Hosting backend has access to it. If the secret already exists in your project, please grant your App Hosting backend access to it with the CLI command 'firebase apphosting:secrets:grantaccess'. See https://firebase.google.com/docs/app-hosting/configure#secret-parameters for more information.","rawLog":"getting secret version: rpc error: code = PermissionDenied desc = Permission 'secretmanager.versions.get' denied on resource (or it may not exist).\nerror details: name = ErrorInfo reason = IAM_PERMISSION_DENIED domain = iam.googleapis.com metadata = map[permission:secretmanager.versions.get]","isUserAttributed":true}
--------------------------------------------------------------------------------
Sorry your project couldn't be built.
Our documentation explains ways to configure Buildpacks to better recognise your project:
 -> https://cloud.google.com/docs/buildpacks/overview
If you think you've found an issue, please report it:
 -> https://github.com/GoogleCloudPlatform/buildpacks/issues/new
--------------------------------------------------------------------------------
Finished Step #1 - "preparer"
ERROR
ERROR: build step 1 "asia-southeast1-docker.pkg.dev/serverless-runtimes/utilities/preparer:base_20260409_18_04_RC00" failed: step exited with non-zero status: 100
