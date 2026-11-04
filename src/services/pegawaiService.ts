import { supabaseAdmin, supabaseClient } from "../config/supabase";

export const getAllPegawaiService = async () => {
    const {data,error} = await supabaseClient.from('profiles').select('*')
    if (error) { 
        throw new Error(error.message);
    }
    return data;
}

export const addNewPegawaiService = async (userData: any, profileData: any) => {
    const {data: user, error: userError} = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
            full_name: userData.full_name,
            role: userData.role,
        },
    });
    
    if (userError) {
        throw new Error(userError.message);
    }

    const {data: profile, error: profileError} = await supabaseAdmin
        .from('profiles')
        .upsert({
            id: user.user.id,
            name: userData.full_name,
            email: userData.email,
            role: userData.role,
            avatar_url: profileData.avatar_url || null,
            status: 'Aktif'
        }, {
            onConflict: 'id'
        });

    if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(user.user.id);
        throw new Error(profileError.message);
    }

    return { user, profile };
}

export const editPegawaiService = async (id: string, updateData: any) => {

    const filteredUpdateData: any = {};
    
    if (updateData.full_name) {
        filteredUpdateData.name = updateData.full_name;
    }
    if (updateData.role) {
        filteredUpdateData.role = updateData.role;
    }
    if (updateData.status) {
        filteredUpdateData.status = updateData.status;
    }

    if (Object.keys(filteredUpdateData).length === 0) {
        throw new Error('Tidak ada data yang valid untuk diupdate');
    }

    const { data, error } = await supabaseAdmin
        .from('profiles')
        .update(filteredUpdateData)
        .eq('id', id)
        .select();

    if (error) {
        throw new Error(error.message);
    }

    if (!data || data.length === 0) {
        throw new Error('Pegawai tidak ditemukan');
    }

    return data[0];
}

export const deletePegawaiService = async (id:string) => {
    const {data,error} = await supabaseAdmin.auth.admin.deleteUser(id);
        if(error){
            throw new Error(error.message);
        }
    return data;
}

export const resetPegawaiPasswordService = async (id: string, password: string) => {
    const { data: user, error: userError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        password: password,
    });
    
    if (userError) {
        throw new Error(userError.message);
    }
    
    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
        
    if (profileError) {
        throw new Error(profileError.message);
    }
    
    return { user, profile };
}



