//lager en axios instans hvor vi slipper manuelt å legge på Bearer token i axios 
// gpt 
import axios from 'axios';


const api = axios.create({
    baseURL: '/api'
});

api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if(token){
        config.headers.Authorization = `Bearer ${token}`
    }
    return config;
})

export default api;