import {Request, Response} from "express";
import { getAllPegawaiService, deletePegawaiService, editPegawaiService, addNewPegawaiService, resetPegawaiPasswordService } from "../services/pegawaiService";

export const getAllPegawaiController = async (req: Request, res: Response) => {
    try {
        const pegawai = await getAllPegawaiService();
        return res.status(200).json({
            success: true,
            data: pegawai,
            message: "Data pegawai berhasil diambil"
        });
    } catch (error: any) {
        return res.status(500).json({ 
            success: false,
            message: "Gagal mengambil data pegawai", 
            error: error.message 
        });
    }
}

export const addNewPegawaiController = async (req: Request, res: Response) => {
    try {
        const { email, password, full_name, role, avatar_url } = req.body;
        
        // Validasi input
        if (!email || !password || !full_name || !role) {
            return res.status(400).json({ 
                success: false,
                message: "Email, password, nama lengkap, dan role wajib diisi" 
            });
        }

        const userData = { email, password, full_name, role };
        const profileData = { avatar_url };

        const result = await addNewPegawaiService(userData, profileData);
        
        return res.status(201).json({ 
            success: true,
            message: "Pegawai berhasil ditambahkan", 
            data: {
                id: result.user.user.id,
                email: result.user.user.email,
                full_name: full_name,
                role: role
            }
        });
    } catch (error: any) {
        // Handle specific errors
        if (error.message.includes('User already registered')) {
            return res.status(409).json({ 
                success: false,
                message: "Email sudah terdaftar" 
            });
        }
        if (error.message.includes('Password should be at least')) {
            return res.status(400).json({ 
                success: false,
                message: "Password minimal 6 karakter" 
            });
        }
        return res.status(500).json({ 
            success: false,
            message: "Gagal menambahkan pegawai", 
            error: error.message 
        });
    }
}

export const editPegawaiController = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { full_name, role, status } = req.body;

        if (!id) {
            return res.status(400).json({ 
                success: false,
                message: "ID pegawai diperlukan" 
            });
        }

        if (!full_name && !role && !status) {
            return res.status(400).json({ 
                success: false,
                message: "Minimal satu field harus diisi (full_name, role, atau status)" 
            });
        }

        if (status && !['active', 'inactive'].includes(status)) {
            return res.status(400).json({ 
                success: false,
                message: "Status harus berupa 'active' atau 'inactive'" 
            });
        }

        const updateData = { full_name, role, status };
        const updatedPegawai = await editPegawaiService(id as any, updateData);
        return res.status(200).json({ 
            success: true,
            message: "Pegawai berhasil diperbarui", 
            data: updatedPegawai 
        });
    } catch (error: any) {
        if (error.message === 'Tidak ada data yang valid untuk diupdate') {
            return res.status(400).json({ 
                success: false,
                message: error.message 
            });
        }
        if (error.message === 'Pegawai tidak ditemukan') {
            return res.status(404).json({ 
                success: false,
                message: error.message 
            });
        }
        return res.status(500).json({ 
            success: false,
            message: "Gagal memperbarui pegawai", 
            error: error.message 
        });
    }
}

export const deletePegawaiController = async (req: Request, res: Response) => {
    try {
        const {id} = req.params;
        if (!id) {
            return res.status(400).json({ 
                success: false,
                message: "ID pegawai diperlukan" 
            });
        }
        await deletePegawaiService(id as string);
        return res.status(200).json({ 
            success: true,
            message: "Pegawai berhasil dihapus",
            data: { id }
        });
    } catch (error: any) {
        return res.status(500).json({ 
            success: false,
            message: "Gagal menghapus pegawai", 
            error: error.message 
        });
    }
}

export const resetPegawaiPasswordController = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { password } = req.body;

        if (!id) {
            return res.status(400).json({ 
                success: false,
                message: "ID pegawai diperlukan" 
            });
        }

        if (!password) {
            return res.status(400).json({ 
                success: false,
                message: "Password baru wajib diisi" 
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password minimal 6 karakter"
            });
        }

        const result = await resetPegawaiPasswordService(id as string, password);
        return res.status(200).json({ 
            success: true,
            message: "Password pegawai berhasil diperbarui", 
            data: {
                id: result.profile.id,
                name: result.profile.name,
                email: result.profile.email,
            }
        });
    } catch (error: any) {
        return res.status(500).json({ 
            success: false,
            message: "Gagal mereset password pegawai", 
            error: error.message 
        });
    }
}