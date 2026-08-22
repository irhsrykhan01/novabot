module.exports = {
    name: 'getidch',
    category: 'owner',
    description: 'Mengubah link WhatsApp Channel menjadi JID (@newsletter)',

    async execute(sock, msg, args) {
        const sender = msg.key.remoteJid;

        // Validasi input link
        if (!args[0]) {
            return sock.sendMessage(sender, { 
                text: '⚠️ *Format Salah!*\n\nContoh penggunaan:\n*.getidch https://whatsapp.com/channel/0029VaXXXXX*' 
            }, { quoted: msg });
        }

        const link = args[0].trim();

        // Validasi apakah itu benar-benar link WhatsApp Channel
        if (!link.includes('whatsapp.com/channel/')) {
            return sock.sendMessage(sender, { 
                text: '⚠️ *Link Tidak Valid!*\nPastikan kamu memasukkan link WhatsApp Channel yang benar.' 
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(sender, { text: '⏳ *Sedang mengambil data channel...*' });

            // Mengekstrak kode invite dari URL
            // Contoh URL: https://whatsapp.com/channel/0029VaXXXXX
            const inviteCode = link.split('/channel/')[1].split('/')[0];

            // Menggunakan fungsi newsletterMetadata dari Baileys
            const channelInfo = await sock.newsletterMetadata('invite', inviteCode);
            
            // Format pesan balasan yang rapi
            const replyText = `✅ *Data Channel Ditemukan!*\n\n` +
                              `📛 *Nama:* ${channelInfo.name || 'Tidak diketahui'}\n` +
                              `👥 *Pengikut:* ${channelInfo.subscribers || 'Tidak diketahui'}\n` +
                              `🆔 *ID Channel:*\n\`${channelInfo.id}\`\n\n` +
                              `_Silakan salin ID di atas dan gunakan untuk command .setchannel_`;

            await sock.sendMessage(sender, { text: replyText }, { quoted: msg });

        } catch (error) {
            console.error('[ERROR getidch]:', error);
            await sock.sendMessage(sender, { 
                text: '❌ *Gagal mengambil ID!*\nPastikan link channel masih aktif/valid dan bot tidak terblokir oleh rate-limit.' 
            }, { quoted: msg });
        }
    }
};
