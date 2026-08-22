const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');

/**
 * Fungsi untuk meneruskan pesan ke Channel (Newsletter)
 * @param {Object} sock - Instance Baileys socket
 * @param {Object} msg - Object pesan yang akan diteruskan
 * @param {String} channelJid - ID channel tujuan (format: 123456789@newsletter)
 */
async function publishToChannel(sock, msg, channelJid) {
    try {
        const type = getContentType(msg.message);
        
        // 1. Jika Pesan adalah Teks biasa
        if (type === 'conversation' || type === 'extendedTextMessage') {
            const textContent = msg.message.conversation || msg.message.extendedTextMessage.text;
            return await sock.sendMessage(channelJid, { text: textContent });
        }

        // 2. Jika Pesan adalah Media (Gambar, Video, Audio, Dokumen, Sticker)
        const isMedia = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].includes(type);
        
        if (isMedia) {
            // Kita download dulu buffernya secara utuh
            const mediaBuffer = await downloadMediaMessage(
                msg,
                'buffer',
                {},
                { 
                    logger: console, // Biar kalau gagal download kelihatan errornya
                    reuploadRequest: sock.updateMediaMessage 
                }
            );

            // Kita tentukan tipe file dan kirim sebagai pesan baru (bukan di-forward mentah)
            if (type === 'imageMessage') {
                const caption = msg.message.imageMessage.caption || '';
                return await sock.sendMessage(channelJid, { image: mediaBuffer, caption: caption });
            } 
            
            else if (type === 'videoMessage') {
                const caption = msg.message.videoMessage.caption || '';
                return await sock.sendMessage(channelJid, { video: mediaBuffer, caption: caption, mimetype: 'video/mp4' });
            } 
            
            else if (type === 'audioMessage') {
                // Pastikan mimetype jelas dan ptt (voice note) disesuaikan
                const isPtt = msg.message.audioMessage.ptt || false;
                return await sock.sendMessage(channelJid, { 
                    audio: mediaBuffer, 
                    mimetype: 'audio/mp4', 
                    ptt: isPtt 
                });
            } 
            
            else if (type === 'documentMessage') {
                const fileName = msg.message.documentMessage.fileName || 'document.file';
                const mime = msg.message.documentMessage.mimetype || 'application/octet-stream';
                return await sock.sendMessage(channelJid, { 
                    document: mediaBuffer, 
                    mimetype: mime, 
                    fileName: fileName 
                });
            }

            else if (type === 'stickerMessage') {
                 return await sock.sendMessage(channelJid, { sticker: mediaBuffer });
            }
        }
        
        // Jika format tidak dikenali
        console.log(`Format ${type} tidak didukung untuk dikirim ke Channel.`);
        return null;

    } catch (err) {
        console.error('Error di publishToChannel:', err);
        throw new Error('Gagal memproses dan mengirim media ke channel.');
    }
}

module.exports = { publishToChannel };
