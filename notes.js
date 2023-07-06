// styles
// migrated to main.css

// search
const searchUrl = "https://app.powerbi.com/search?experience=power-bi&searchQuery=" + query

// get workspaces
fetch("https://wabi-us-north-central-b-redirect.analysis.windows.net/powerbi/metadata/app?preferReadOnlySession=true", {"headers": {
	"Authorization": "Bearer " + powerBIAccessToken,
	"Accept": "application/json; charset=utf-8"
}}).then(r=>r.json()).then(r=>console.log(r.folders))
// example "folder"
{
    "id": 551,
    "displayName": "Workspace name",
    "iconUrl": "powerbi/resource/images/2/2dc2ad66-********************/FolderIcon/BlobIdV2-9da0ec63-ddd1-4fb1-90dd-**********************.jpg",
    "objectId": "2b595037-e345-4b1a-b919-fc88f25c90ed",
    "parentFolderId": 551,
    "rootFolderId": 551,
    "permissions": 15,
    "capacityObjectId": "C04FA9D6-******************",
    "capacitySku": "SharedOnPremium",
    "type": 1,
    "sharePointStorage": {
        "id": 134,
        "folderId": 551,
        "groupId": 30189,
        "groupObjectId": "2b595037-e345-*************************",
        "groupFilesUrl": "https://***********.sharepoint.com/teams/****************************/Shared Documents",
        "groupDisplayName": "Workspace name"
    },
    "capacitySkuTier": 6,
    "capacityRolloutRegion": "North Central US",
    "capacityRolloutName": "NorthCentralUS",
    "capacityRolloutUrl": "https://northcentralus.pbidedicated.windows.net"
}