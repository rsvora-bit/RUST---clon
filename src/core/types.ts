import type {Station} from '../survival/stations';
export type Vec3 = {x:number; y:number; z:number};
export type ItemId = 'rock'|'torch'|'wood'|'stone'|'metal'|'fiber'|'berries'|'hatchet'|'pickaxe'|'plan'|'bandage'|'canteen'|'campfire'|'ore'|'storage'|'furnace'|'workbench1'|'workbench2'|'workbench3'|'bedroll';
export type ItemCategory = 'resource'|'tool'|'food'|'building'|'utility';
export type Language = 'en'|'cs';
export type GraphicsQuality = 'low'|'medium'|'high'|'ultra';
export type ShadowQuality = 'low'|'medium'|'high';
export type KeybindAction = 'forward'|'backward'|'left'|'right'|'sprint'|'jump'|'crouch'|'interact'|'inventory'|'build'|'rotate'|'cycleBuild'|'use'|'map'|'maintenance'|'autoRun'|'inspect';
export type Keybinds = Record<KeybindAction,string>;
export interface ItemDefinition {id:ItemId; displayName:string; description:string; category:ItemCategory; icon:string; maxStack:number; placeable?:boolean; consumable?:boolean; tags:string[]}
export interface ItemStack {itemId:ItemId; count:number}
export interface RecipeDefinition {id:string; resultItemId:ItemId; resultCount:number; ingredients:Partial<Record<ItemId,number>>; category:string; craftTime:number; requiredWorkbenchLevel?:number}
export type PieceType = 'foundation'|'wall'|'doorway'|'floor'|'roof'|'door';
export interface Structure {id:string; pieceType:PieceType; position:Vec3; rotation:number; health:number; grade?:'wood'|'stone'|'metal'; maxHealth?:number; createdAt:number; open?:boolean; parentId?:string; socketId?:string}
export interface ResourceNode {id:string; kind:'tree'|'stone'|'metal'|'fiber'|'berries'|'wood'; position:Vec3; scale:number; rotation:number; capacity:number; remaining:number; depletedAt?:number}
export interface DroppedItem {id:string; stack:ItemStack; position:Vec3}
export interface PlayerStats {health:number; hunger:number; thirst:number; stamina:number}
export interface CraftJob {recipeId:string; remaining:number; total:number}
export interface GameState {progression?:{version:1;stations:Station[];spawnId?:string;waypoint?:{x:number;z:number};weather:{kind:'clear'|'rain'|'fog'|'storm';blend:number;rain?:number;mist?:number;storm?:number;remaining:number};lootGenerated:boolean};version:1; worldGeneration?:1|2; seed:number; elapsed:number; timeOfDay:number; player:{position:Vec3; yaw:number; pitch:number; stats:PlayerStats}; inventory:(ItemStack|null)[]; activeSlot:number; structures:Structure[]; nodeChanges:Record<string,number>; drops:DroppedItem[]; craftQueue:CraftJob[]; nextId:number}
export interface SaveSlotSummary {slot:number; exists:boolean; seed?:number; savedAt?:number; elapsed?:number; timeOfDay?:number; structures?:number; worldGeneration?:1|2}
export interface Settings {language:Language; sensitivityX:number; sensitivityY:number; fov:number; viewmodelFov:number; invertY:boolean; headBob:boolean; cameraShake:boolean; motionBlur:boolean; masterVolume:number; musicVolume:number; effectsVolume:number; ambientVolume:number; quality:GraphicsQuality; renderScale:number; shadows:boolean; shadowQuality:ShadowQuality; shadowDistance:number; foliageDensity:number; postProcessing:boolean; ambientOcclusion:boolean; bloom:boolean; crosshairOpacity:number; crosshairScale:number; hudScale:number; hudOpacity:number; brightness:number; showCompass:boolean; showFps:boolean; showTutorialHints:boolean; keybinds:Keybinds}
export interface BuildCandidate {pieceType:PieceType; position:Vec3; rotation:number; valid:boolean; reason:string; parentId?:string; socketId?:string; snapped:boolean}
export type Screen = 'menu'|'playing'|'inventory'|'pause'|'settings'|'dead'|'station';
export interface InteractionInfo {title:string; action:string; key:string; detail?:string; progress?:number}
export interface HUDData {stats:PlayerStats; inventory:(ItemStack|null)[]; activeSlot:number; compass:number; biome:string; timeOfDay:number; interaction:InteractionInfo|null; build:{piece:PieceType;valid:boolean;reason:string;cost:string}|null; fps:number; diagnostics:string; tutorial:string}
export interface UIActions {respawn:()=>void;newGame:(seed?:number,slot?:number)=>void;continueGame:(slot?:number)=>void;resume:()=>void;save:()=>void;mainMenu:()=>void;resetSave:()=>void;deleteSave:(slot:number)=>void;settings:(settings:Settings)=>void;setScreen:(screen:Screen)=>void;moveItem:(from:number,to:number,split:boolean)=>void;dropItem:(slot:number)=>void;consume:(slot:number)=>void;craft:(id:string)=>void;canCraft:(id:string)=>boolean;selectSlot:(slot:number)=>void;selectPiece:(piece:PieceType)=>void;dev:(action:string,value?:number)=>void}