import { connectSocket, getSocket } from '../lib/socket';

let accessToken = '';

export const getAccessToken = () => {
    return accessToken;
};
export const setAccessToken = (token: string) => {
    accessToken = token;

    const socket = getSocket();
    if (socket?.connected) {
        socket?.disconnect();
    }
    connectSocket();
};

export const languages = ['cpp', 'python', 'javascript', 'java'];
