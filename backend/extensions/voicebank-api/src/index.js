import AdmZip from 'adm-zip';
import { join } from 'path';

export default function registerEndpoint(router, { services, database, getSchema }) {
	const { ItemsService } = services;

	// Route de test
	router.get('/', (req, res) => {
		res.json({ message: 'Voicebank API is working!' });
	});

	// Route pour récupérer un fichier audio spécifique
	router.get('/:voicebankName/:fileName', async (req, res) => {
		try {
			const { voicebankName, fileName } = req.params;
			
			const schema = await getSchema({ database });
			const voicebankService = new ItemsService('voicebanks', {
				schema: schema,
				knex: database,
				accountability: null,
			});

			// Rechercher la voicebank par nom
			const voicebanks = await voicebankService.readByQuery({
				filter: { name: { _eq: voicebankName } },
				fields: ['*', 'sample_files.*'],
			});

			if (!voicebanks || voicebanks.length === 0) {
				return res.status(404).json({
					error: `Voicebank "${voicebankName}" not found`,
				});
			}

			const voicebank = voicebanks[0];

			if (!voicebank.sample_files) {
				return res.status(404).json({
					error: 'No sample files found for this voicebank',
				});
			}

			const fileData = voicebank.sample_files;
			
			if (!fileData || !fileData.filename_disk) {
				return res.status(404).json({
					error: 'ZIP file not found',
				});
			}

			// Chemin vers le fichier ZIP
			const uploadsDir = join(process.cwd(), 'uploads');
			const zipPath = join(uploadsDir, fileData.filename_disk);

			// Extraire le fichier audio spécifique du ZIP
			const zip = new AdmZip(zipPath);
			const zipEntries = zip.getEntries();

			let audioFile = null;

			// Chercher le fichier demandé (insensible à la casse)
			for (const entry of zipEntries) {
				if (!entry.isDirectory) {
					const entryFileName = join('/', entry.entryName).split('/').pop().toLowerCase();
					const requestedFileName = fileName.toLowerCase();
					
					if (entryFileName === requestedFileName) {
						audioFile = {
							name: join('/', entry.entryName).split('/').pop(),
							path: entry.entryName,
							size: entry.header.size,
							buffer: entry.getData(),
						};
						break;
					}
				}
			}

			if (!audioFile) {
				return res.status(404).json({
					error: `File "${fileName}" not found in voicebank`,
				});
			}

			// Détecter le type MIME du fichier audio
			const ext = audioFile.name.toLowerCase().split('.').pop();
			let mimeType = 'application/octet-stream';
			
			if (ext === 'wav') mimeType = 'audio/wav';
			else if (ext === 'mp3') mimeType = 'audio/mpeg';
			else if (ext === 'ogg') mimeType = 'audio/ogg';
			else if (ext === 'flac') mimeType = 'audio/flac';

			// Encoder le nom de fichier pour le header Content-Disposition (RFC 2231)
			const encodedFilename = encodeURIComponent(audioFile.name);

			// Envoyer le fichier audio
			res.setHeader('Content-Type', mimeType);
			res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedFilename}`);
			res.setHeader('Content-Length', audioFile.size);
			res.setHeader('Cache-Control', 'public, max-age=31536000');
			
			return res.send(audioFile.buffer);

		} catch (error) {
			console.error('Error extracting audio file:', error);
			return res.status(500).json({
				error: 'Failed to extract audio file',
				details: error.message,
			});
		}
	});

	// Route pour lister tous les fichiers d'une voicebank
	router.get('/:voicebankName', async (req, res) => {
		try {
			const { voicebankName } = req.params;
			
			const schema = await getSchema({ database });
			const voicebankService = new ItemsService('voicebanks', {
				schema: schema,
				knex: database,
				accountability: null,
			});

			const voicebanks = await voicebankService.readByQuery({
				filter: { name: { _eq: voicebankName } },
				fields: ['*', 'sample_files.*'],
			});

			if (!voicebanks || voicebanks.length === 0) {
				return res.status(404).json({
					error: `Voicebank "${voicebankName}" not found`,
				});
			}

			const voicebank = voicebanks[0];

			if (!voicebank.sample_files) {
				return res.status(404).json({
					error: 'No sample files found for this voicebank',
				});
			}

			const fileData = voicebank.sample_files;
			
			if (!fileData || !fileData.filename_disk) {
				return res.status(404).json({
					error: 'ZIP file not found',
				});
			}

			// Chemin vers le fichier ZIP
			const uploadsDir = join(process.cwd(), 'uploads');
			const zipPath = join(uploadsDir, fileData.filename_disk);

			// Extraire les fichiers .wav du ZIP
			const zip = new AdmZip(zipPath);
			const zipEntries = zip.getEntries();

			const wavFiles = [];

			zipEntries.forEach((entry) => {
				if (!entry.isDirectory && entry.entryName.toLowerCase().endsWith('.wav')) {
					const fileName = join('/', entry.entryName).split('/').pop();
					
					wavFiles.push({
						name: fileName,
						path: entry.entryName,
						size: entry.header.size,
					});
				}
			});

			return res.json({
				voicebank: voicebank.name,
				totalFiles: wavFiles.length,
				files: wavFiles,
			});

		} catch (error) {
			console.error('Error extracting voicebank files:', error);
			return res.status(500).json({
				error: 'Failed to extract voicebank files',
				details: error.message,
			});
		}
	});
}
