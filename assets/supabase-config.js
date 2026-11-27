/* Connexion à la base Supabase de l'agence.
   Ces deux valeurs sont PUBLIQUES par conception (URL du projet + clé « publishable ») : elles ne donnent aucun accès sans compte connecté,
   les règles de sécurité de la base (RLS, voir supabase/schema.sql) bloquent tout visiteur anonyme.
   Ne JAMAIS mettre ici la clé « secret » / « service_role » ni le mot de passe de la base. */
window.CREATIGO_SB = {
  url: 'https://gzkfwamiawpuossgwsed.supabase.co',
  key: 'sb_publishable_F0_BzRg8b8zndStQ7zrlBw_dwn_831z',
  // Fonctions de Jarvis (assistant IA) : fonction Supabase « jarvis » (voir supabase/functions/jarvis/LISEZ-MOI.txt). Valeur vide = Netlify (/api/…).
  api: 'https://gzkfwamiawpuossgwsed.supabase.co/functions/v1/jarvis',
}
