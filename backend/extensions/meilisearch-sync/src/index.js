import { MeiliSearch } from 'meilisearch';

export default ({ action }, { env, services, logger }) => {
  // Configuration du client Meilisearch
  const client = new MeiliSearch({
    host: env.MEILISEARCH_HOST || 'http://localhost:7700',
    apiKey: env.MEILISEARCH_API_KEY
  });

  const indexName = `${env.MEILISEARCH_INDEX_PREFIX || 'directus_'}projects`;
  const index = client.index(indexName);

  // Fonction utilitaire pour transformer un projet pour Meilisearch
  async function transformProjectForSearch(projectId, services) {
    try {
      const { ItemsService } = services;
      const projectsService = new ItemsService('Projects', {
        knex: services.knex,
        schema: services.schema
      });

      const project = await projectsService.readOne(projectId, {
        fields: [
          '*',
          'user_created.id',
          'user_created.first_name',
          'user_created.last_name',
          'user_created.email',
          'primary_voicebank.id',
          'primary_voicebank.name',
          'tags.id',
          'cover_image'
        ]
      });

      if (!project || project.status !== '1') { // '1' = published
        return null; // Ne pas indexer les projets non publiés
      }

      return {
        id: project.id,
        title: project.title || '',
        searchable_content: `${project.title || ''} ${project.description || ''}`,
        description: project.description || '',
        tempo: parseInt(project.tempo) || 120,
        key_signature: project.key_signature || 'C',
        duration: parseInt(project.duration) || 0,
        creator: `${project.user_created?.first_name || ''} ${project.user_created?.last_name || ''}`.trim(),
        creator_id: project.user_created?.id,
        voicebank_name: project.primary_voicebank?.name || '',
        voicebank_id: project.primary_voicebank?.id,
        plays: parseInt(project.plays) || 0,
        likes: parseInt(project.likes) || 0,
        status: project.status,
        collection: 'projects',
        cover_image: project.cover_image || null
      };
    } catch (error) {
      logger.error(`Erreur transformation projet ${projectId}:`, error.message);
      return null;
    }
  }

  // Hook CREATE : Nouveau projet créé
  action('Projects.items.create', async ({ key, payload }) => {
    try {
      if (payload.status === '1') { // '1' = published
        const document = await transformProjectForSearch(key, services);
        if (document) {
          await index.addDocuments([document], { primaryKey: 'id' });
          logger.info(`Projet ${key} ajouté à l'index Meilisearch`);
        }
      }
    } catch (error) {
      logger.error(`Erreur sync CREATE projet ${key}:`, error.message);
    }
  });

  // Hook UPDATE : Projet modifié
  action('Projects.items.update', async ({ keys, payload }) => {
    try {
      for (const key of keys) {
        const document = await transformProjectForSearch(key, services);
        if (document) {
          // Projet publié : mettre à jour dans l'index
          await index.updateDocuments([document], { primaryKey: 'id' });
          logger.info(`Projet ${key} mis à jour dans Meilisearch`);
        } else {
          // Projet dépublié : supprimer de l'index
          await index.deleteDocument(key);
          logger.info(`Projet ${key} supprimé de l'index Meilisearch`);
        }
      }
    } catch (error) {
      logger.error(`Erreur sync UPDATE projets:`, error.message);
    }
  });

  // Hook DELETE : Projet supprimé
  action('Projects.items.delete', async ({ keys }) => {
    try {
      await index.deleteDocuments(keys);
      logger.info(`Projets ${keys.join(', ')} supprimés de Meilisearch`);
    } catch (error) {
      logger.error(`Erreur sync DELETE projets:`, error.message);
    }
  });

  logger.info('Hook Meilisearch initialisé pour la collection Projects');
};
