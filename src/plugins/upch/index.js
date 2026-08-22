// Command: .upch (sambil me-reply pesan yang mau dikirim)
const { publishToChannel } = require('../../core/channel-publisher');

module.exports = {
    name: 'upch',
    category: 'owner',
    description: 'Meneruskan pesan yang di-reply ke Channel',
    
    async execute(sock, msg, args) {
        const sender = msg.key.remoteJid;
        
        // Ambil target channel dari database yang diset oleh plugin setchannel
        const targetChannel = global.db?.targetChannel; 
        
        if (!targetChannel) {
            return sock.sendMessage(sender, { 
                text: '⚠️ ID Channel belum diatur! Gunakan perintah *.setchannel* terlebih dahulu.' 
            }, { quoted: msg });
        }

        // Cek apakah user menggunakan command ini sambil me-reply sebuah pesan
        const isQuoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        if (!isQuoted) {
            return sock.sendMessage(sender, { 
                text: '⚠️ Reply pesan (teks/media) yang ingin kamu kirim ke Channel, lalu ketik *.upch*' 
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(sender, { text: '⏳ Sedang memproses dan mengunggah ke Channel...' });

            // Rekonstruksi struktur pesan yang di-reply agar menyerupai object pesan asli
            // Ini dibutuhkan oleh fungsi downloadMediaMessage di Baileys
            const quotedMsgObj = {
                key: {
                    remoteJid: msg.key.remoteJid,
                    id: msg.message.extendedTextMessage.contextInfo.stanzaId
                },
                message: isQuoted
            };

            // Kirim pesan tiruan tersebut ke mesin publisher kita
            await publishToChannel(sock, quotedMsgObj, targetChannel);

            await sock.sendMessage(sender, { text: '✅ Pesan berhasil dipublish ke Channel!' });

        } catch (error) {
            console.error('Error saat upch:', error);
            await sock.sendMessage(sender, { 
                text: '❌ Gagal mengirim ke channel. Cek log terminal (kemungkinan file corrupt atau timeout dari server WA).' 
            }, { quoted: msg });
        }
    }
};
