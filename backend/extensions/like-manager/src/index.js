export default {
  id: 'like-manager',
  handler: (router, { services, database, getSchema, logger }) => {
    const { ItemsService } = services;

    // POST /like-manager/toggle - Like/Unlike un projet
    router.post('/toggle', async (req, res) => {
      try {
        const { project_id } = req.body;
        const user_id = req.accountability?.user;

        if (!project_id || !user_id) {
          return res.status(400).json({
            error: 'project_id et user_id requis'
          });
        }

        const schema = await getSchema();
        const likesService = new ItemsService('projects_likes', { schema, accountability: req.accountability });
        const projectsService = new ItemsService('Projects', { schema, accountability: req.accountability });

        // 1. Vérifier si l'utilisateur a déjà liké ce projet
        const existingLikes = await likesService.readByQuery({
          filter: {
            project_id: { _eq: project_id },
            user_id: { _eq: user_id }
          }
        });

        let action, message;

        if (existingLikes.length > 0) {
          // UNLIKE : L'utilisateur retire son like
          await likesService.deleteOne(existingLikes[0].id);

          // Décrémenter le compteur de likes dans le projet
          const project = await projectsService.readOne(project_id, { fields: ['likes_count'] });
          const newCount = Math.max(0, (project.likes_count || 0) - 1);
          
          await projectsService.updateOne(project_id, {
            likes_count: newCount
          });

          action = 'unliked';
          message = 'Like retiré avec succès';

        } else {
          // LIKE : L'utilisateur ajoute son like
          await likesService.createOne({
            project_id,
            user_id
          });

          // Incrémenter le compteur de likes dans le projet
          const project = await projectsService.readOne(project_id, { fields: ['likes_count'] });
          const newCount = (project.likes_count || 0) + 1;
          
          await projectsService.updateOne(project_id, {
            likes_count: newCount
          });

          action = 'liked';
          message = 'Projet liké avec succès';
        }

        // 2. Récupérer les données du projet mis à jour
        const updatedProject = await projectsService.readOne(project_id, {
          fields: ['id', 'title', 'likes_count', 'user_created.first_name', 'user_created.last_name']
        });

        // 3. Récupérer les infos de l'utilisateur qui like
        const usersService = new ItemsService('directus_users', { schema, accountability: req.accountability });
        const currentUser = await usersService.readOne(user_id, { 
          fields: ['first_name', 'last_name', 'email'] 
        });

        // 4. Envoyer notification WebSocket personnalisée (si disponible)
        if (req.services?.websocket) {
          req.services.websocket.broadcast('like_notification', {
            type: 'like_event',
            action: action,
            project: {
              id: updatedProject.id,
              title: updatedProject.title,
              likes: updatedProject.likes_count,
              author: updatedProject.user_created
            },
            user: {
              name: `${currentUser.first_name} ${currentUser.last_name}`,
              email: currentUser.email
            },
            timestamp: new Date().toISOString()
          });
        }

        logger.info(`Like action: ${action} - Project ${project_id} by user ${user_id}`);

        res.json({
          success: true,
          action,
          message,
          data: {
            project_id,
            user_id,
            likes_count: updatedProject.likes_count || 0,
            user_has_liked: action === 'liked'
          }
        });

      } catch (error) {
        logger.error('Erreur dans like-manager:', error);
        res.status(500).json({
          error: 'Erreur interne du serveur',
          details: error.message
        });
      }
    });

    // GET /like-manager/status/:project_id - Vérifier le statut de like d'un projet
    router.get('/status/:project_id', async (req, res) => {
      try {
        const { project_id } = req.params;
        const user_id = req.accountability?.user;

        if (!user_id) {
          return res.status(401).json({ error: 'Authentification requise' });
        }

        const schema = await getSchema();
        const likesService = new ItemsService('projects_likes', { schema, accountability: req.accountability });
        const projectsService = new ItemsService('Projects', { schema, accountability: req.accountability });

        // Vérifier si l'user a liké ce projet
        const existingLikes = await likesService.readByQuery({
          filter: {
            project_id: { _eq: project_id },
            user_id: { _eq: user_id }
          }
        });

        // Récupérer le nombre total de likes
        const project = await projectsService.readOne(project_id, {
          fields: ['likes_count']
        });

        res.json({
          project_id,
          user_has_liked: existingLikes.length > 0,
          total_likes: project.likes_count || 0
        });

      } catch (error) {
        logger.error('Erreur status like-manager:', error);
        res.status(500).json({
          error: 'Erreur interne du serveur',
          details: error.message
        });
      }
    });

    // GET /like-manager/user-likes - Récupérer tous les projets likés par l'utilisateur
    router.get('/user-likes', async (req, res) => {
      try {
        const user_id = req.accountability?.user;

        if (!user_id) {
          return res.status(401).json({ error: 'Authentification requise' });
        }

        const schema = await getSchema();
        const likesService = new ItemsService('projects_likes', { schema, accountability: req.accountability });

        // Récupérer tous les likes de l'utilisateur avec les détails des projets
        const userLikes = await likesService.readByQuery({
          filter: {
            user_id: { _eq: user_id }
          },
          fields: ['id', 'project_id.*', 'date_created'],
          sort: ['-date_created']
        });

        res.json({
          success: true,
          data: userLikes,
          count: userLikes.length
        });

      } catch (error) {
        logger.error('Erreur user-likes:', error);
        res.status(500).json({
          error: 'Erreur interne du serveur',
          details: error.message
        });
      }
    });
  },
};
