"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaylistEditorModule = void 0;
const common_1 = require("@nestjs/common");
const playlist_editor_controller_1 = require("./playlist-editor.controller");
const playlist_editor_service_1 = require("./playlist-editor.service");
let PlaylistEditorModule = class PlaylistEditorModule {
};
exports.PlaylistEditorModule = PlaylistEditorModule;
exports.PlaylistEditorModule = PlaylistEditorModule = __decorate([
    (0, common_1.Module)({
        controllers: [playlist_editor_controller_1.PlaylistEditorController],
        providers: [playlist_editor_service_1.PlaylistEditorService]
    })
], PlaylistEditorModule);
//# sourceMappingURL=playlist-editor.module.js.map