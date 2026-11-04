// filepath: /home/hadi/dev/umah-tani-web-be/src/types/pegawai.ts
export interface CreateUserData {
    email: string;
    password: string;
    full_name: string;
    role: string;
}

export interface CreateProfileData {
    avatar_url?: string;
}