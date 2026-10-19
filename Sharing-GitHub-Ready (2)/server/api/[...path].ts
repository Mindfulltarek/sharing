import { defineHandler } from 'nitro/h3';
import api from '../api';

export default defineHandler((event) => api.fetch(event.req as unknown as Request));
