// The n8n entry: the chat tile, mounted from a library panel's module script.
export { VERSION } from '../kd/define';
export { mount, fillTile, fitChat, injectStyles, chatBundle, chatStyle, type ChatLoader, type CreateChat } from './mount';
export { CHAT_VERSION, settings, type ChatConfig, type Settings } from './config';
export { CONTROL_NODE, controlFilter } from './stream';
export { cleanHistory } from './history';
export { applyState, applyToolCalls, readToolCalls, stateCard, placeCard, RESERVED, type DashboardState, type ToolCalls } from './state';
export { chatMetadata, describeGroups } from './metadata';
export type { ChatHandle, ChatWindow } from './fetch';
