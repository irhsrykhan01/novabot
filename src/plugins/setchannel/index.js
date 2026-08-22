// Command: .setchannel <ID_Channel>
// Contoh: .setchannel 120363000000000000@newsletter

module.exports = {
    name: 'setchannel',
    category: 'owner', // Sebaiknya cuma owner yang bisa atur ini
    description: 'Mengatur target ID Channel untuk bot',
    
    async execute(sock, msg, args) {
        const sender = msg.key.remoteJid;
        
        if (!args[0]) {
            return sock.sendMessage(sender, { 
                text: '⚠️ Format salah!\nKirim: *.setchannel 12345678@newsletter*' 
            }, { quoted: msg });
        }

        const channelId = args[0];
        
        // Validasi format JID Channel (harus berakhiran @newsletter)
        if (!channelId.endsWith('@newsletter')) {
            return sock.sendMessage(sender, { 
                text: '⚠️ JID Channel tidak valid! Harus berakhiran @newsletter.' 
            }, { quoted: msg });
        }

        // Simpan ke database/global variable kamu. 
        // Sesuaikan bagian ini dengan sistem database Novabot kamu!
        if (!global.db) global.db = {};
        global.db.targetChannel = channelId;

        await sock.sendMessage(sender, { 
            text: `✅ Sukses! ID Channel telah diatur ke:\n${channelId}` 
        }, { quoted: msg });
    }
};
