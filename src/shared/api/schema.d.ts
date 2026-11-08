/** Generated from backend OpenAPI. Run npm run api:generate -- <document-or-url>. */
export interface paths {
  '/health/live': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Live */
    get: operations['live_health_live_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/health/ready': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Ready */
    get: operations['ready_health_ready_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/media/{asset_id}/content': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Media Content */
    get: operations['get_media_content_media__asset_id__content_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/auth/login': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** Login */
    post: operations['login_api_v1_auth_login_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/auth/logout': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** Logout */
    post: operations['logout_api_v1_auth_logout_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/auth/csrf': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Issue Csrf Token */
    get: operations['issue_csrf_token_api_v1_auth_csrf_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/auth/me': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Me */
    get: operations['me_api_v1_auth_me_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/teams': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** List Teams */
    get: operations['list_teams_api_v1_teams_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/players': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** List Players */
    get: operations['list_players_api_v1_players_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/players/{player_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Player */
    get: operations['get_player_api_v1_players__player_id__get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/admin/players': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** List Admin Players */
    get: operations['list_admin_players_api_v1_admin_players_get']
    put?: never
    /** Create Player */
    post: operations['create_player_api_v1_admin_players_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/admin/players/{player_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Admin Player */
    get: operations['get_admin_player_api_v1_admin_players__player_id__get']
    put?: never
    post?: never
    /** Delete Player */
    delete: operations['delete_player_api_v1_admin_players__player_id__delete']
    options?: never
    head?: never
    /** Update Player */
    patch: operations['update_player_api_v1_admin_players__player_id__patch']
    trace?: never
  }
  '/api/v1/admin/teams': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** List Admin Teams */
    get: operations['list_admin_teams_api_v1_admin_teams_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/admin/teams/{team_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Admin Team */
    get: operations['get_admin_team_api_v1_admin_teams__team_id__get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    /** Update Admin Team */
    patch: operations['update_admin_team_api_v1_admin_teams__team_id__patch']
    trace?: never
  }
  '/api/v1/content/{section}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** List Public Content */
    get: operations['list_public_content_api_v1_content__section__get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/admin/content': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** List Admin Content */
    get: operations['list_admin_content_api_v1_admin_content_get']
    put?: never
    /** Create Content */
    post: operations['create_content_api_v1_admin_content_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/admin/content/{block_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Admin Content */
    get: operations['get_admin_content_api_v1_admin_content__block_id__get']
    put?: never
    post?: never
    /** Delete Content */
    delete: operations['delete_content_api_v1_admin_content__block_id__delete']
    options?: never
    head?: never
    /** Update Content */
    patch: operations['update_content_api_v1_admin_content__block_id__patch']
    trace?: never
  }
  '/api/v1/competitions': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** List Competitions */
    get: operations['list_competitions_api_v1_competitions_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/venues': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** List Venues */
    get: operations['list_venues_api_v1_venues_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/matches': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** List Matches */
    get: operations['list_matches_api_v1_matches_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/matches/{match_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Match */
    get: operations['get_match_api_v1_matches__match_id__get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/admin/competitions': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** List Admin Competitions */
    get: operations['list_admin_competitions_api_v1_admin_competitions_get']
    put?: never
    /** Create Competition */
    post: operations['create_competition_api_v1_admin_competitions_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/admin/competitions/{competition_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Admin Competition */
    get: operations['get_admin_competition_api_v1_admin_competitions__competition_id__get']
    put?: never
    post?: never
    /** Delete Competition */
    delete: operations['delete_competition_api_v1_admin_competitions__competition_id__delete']
    options?: never
    head?: never
    /** Update Competition */
    patch: operations['update_competition_api_v1_admin_competitions__competition_id__patch']
    trace?: never
  }
  '/api/v1/admin/venues': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** List Admin Venues */
    get: operations['list_admin_venues_api_v1_admin_venues_get']
    put?: never
    /** Create Venue */
    post: operations['create_venue_api_v1_admin_venues_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/admin/venues/{venue_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Admin Venue */
    get: operations['get_admin_venue_api_v1_admin_venues__venue_id__get']
    put?: never
    post?: never
    /** Delete Venue */
    delete: operations['delete_venue_api_v1_admin_venues__venue_id__delete']
    options?: never
    head?: never
    /** Update Venue */
    patch: operations['update_venue_api_v1_admin_venues__venue_id__patch']
    trace?: never
  }
  '/api/v1/admin/matches': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** List Admin Matches */
    get: operations['list_admin_matches_api_v1_admin_matches_get']
    put?: never
    /** Create Match */
    post: operations['create_match_api_v1_admin_matches_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/admin/matches/{match_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Admin Match */
    get: operations['get_admin_match_api_v1_admin_matches__match_id__get']
    put?: never
    post?: never
    /** Delete Match */
    delete: operations['delete_match_api_v1_admin_matches__match_id__delete']
    options?: never
    head?: never
    /** Update Match */
    patch: operations['update_match_api_v1_admin_matches__match_id__patch']
    trace?: never
  }
  '/api/v1/admin/competitions/{competition_id}/impact': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Competition Impact */
    get: operations['get_competition_impact_api_v1_admin_competitions__competition_id__impact_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/media/{asset_id}/content': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * Get Legacy Media Content
     * @deprecated
     */
    get: operations['get_legacy_media_content_api_v1_media__asset_id__content_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/admin/media': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** List Admin Media */
    get: operations['list_admin_media_api_v1_admin_media_get']
    put?: never
    /** Upload Media */
    post: operations['upload_media_api_v1_admin_media_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/admin/media/{asset_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Admin Media */
    get: operations['get_admin_media_api_v1_admin_media__asset_id__get']
    put?: never
    post?: never
    /** Delete Media */
    delete: operations['delete_media_api_v1_admin_media__asset_id__delete']
    options?: never
    head?: never
    /** Update Media */
    patch: operations['update_media_api_v1_admin_media__asset_id__patch']
    trace?: never
  }
  '/api/v1/admin/media/{asset_id}/usage': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Media Usage */
    get: operations['get_media_usage_api_v1_admin_media__asset_id__usage_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/achievements': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** List Achievements */
    get: operations['list_achievements_api_v1_achievements_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/achievements/{achievement_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Achievement */
    get: operations['get_achievement_api_v1_achievements__achievement_id__get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/admin/achievements': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** List Admin Achievements */
    get: operations['list_admin_achievements_api_v1_admin_achievements_get']
    put?: never
    /** Create Achievement */
    post: operations['create_achievement_api_v1_admin_achievements_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/admin/achievements/{achievement_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Admin Achievement */
    get: operations['get_admin_achievement_api_v1_admin_achievements__achievement_id__get']
    put?: never
    post?: never
    /** Delete Achievement */
    delete: operations['delete_achievement_api_v1_admin_achievements__achievement_id__delete']
    options?: never
    head?: never
    /** Update Achievement */
    patch: operations['update_achievement_api_v1_admin_achievements__achievement_id__patch']
    trace?: never
  }
  '/api/v1/standings/logos/{key}.webp': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Standings Logo */
    get: operations['get_standings_logo_api_v1_standings_logos__key__webp_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/standings/options': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Standings Options */
    get: operations['get_standings_options_api_v1_standings_options_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/standings': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Standings */
    get: operations['get_standings_api_v1_standings_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/admin/standings': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** List Admin Standings */
    get: operations['list_admin_standings_api_v1_admin_standings_get']
    put?: never
    /** Publish Standings */
    post: operations['publish_standings_api_v1_admin_standings_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/admin/standings/{snapshot_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Admin Standings */
    get: operations['get_admin_standings_api_v1_admin_standings__snapshot_id__get']
    put?: never
    post?: never
    /** Delete Standings */
    delete: operations['delete_standings_api_v1_admin_standings__snapshot_id__delete']
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/admin/audit-log': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** List Audit Log */
    get: operations['list_audit_log_api_v1_admin_audit_log_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/admin/imports': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** List Import Jobs */
    get: operations['list_import_jobs_api_v1_admin_imports_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/admin/imports/asb': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** Import Asb */
    post: operations['import_asb_api_v1_admin_imports_asb_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/admin/imports/{job_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Import Job */
    get: operations['get_import_job_api_v1_admin_imports__job_id__get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/home': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Home */
    get: operations['get_home_api_v1_home_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/calendar': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Calendar */
    get: operations['calendar_api_v1_calendar_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/admin/trash/{entity}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** List Deleted */
    get: operations['list_deleted_api_v1_admin_trash__entity__get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/admin/trash/{entity}/{record_id}/restore': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** Restore Deleted */
    post: operations['restore_deleted_api_v1_admin_trash__entity___record_id__restore_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/results-archive/honours': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Club Honours */
    get: operations['club_honours_api_v1_results_archive_honours_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/results-archive/summary': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Archive Summary */
    get: operations['archive_summary_api_v1_results_archive_summary_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/results-archive': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** List Archive */
    get: operations['list_archive_api_v1_results_archive_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/results-archive/tournaments': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Club Tournaments */
    get: operations['club_tournaments_api_v1_results_archive_tournaments_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/asb-roster/{team}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Roster */
    get: operations['get_roster_api_v1_asb_roster__team__get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/asb-roster/{team}/players/{player_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Roster Player */
    get: operations['get_roster_player_api_v1_asb_roster__team__players__player_id__get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/asb-roster/{team}/players/{player_id}/photo': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Roster Player Photo */
    get: operations['get_roster_player_photo_api_v1_asb_roster__team__players__player_id__photo_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
}
export type webhooks = Record<string, never>
export interface components {
  schemas: {
    /** AchievementCreate */
    AchievementCreate: {
      /**
       * Team Id
       * Format: uuid
       */
      team_id: string
      /** Title */
      title: string
      /**
       * Media Asset Id
       * Format: uuid
       */
      media_asset_id: string
      /** Achieved At */
      achieved_at?: string | null
      /**
       * Sort Order
       * @default 0
       */
      sort_order: number
      /**
       * Active
       * @default true
       */
      active: boolean
    }
    /** AchievementRead */
    AchievementRead: {
      /**
       * Id
       * Format: uuid
       */
      id: string
      /**
       * Team Id
       * Format: uuid
       */
      team_id: string
      team: components['schemas']['TeamSummary']
      /** Title */
      title: string
      /**
       * Media Asset Id
       * Format: uuid
       */
      media_asset_id: string
      media: components['schemas']['MediaAssetRead']
      /** Achieved At */
      achieved_at: string | null
      /** Sort Order */
      sort_order: number
      /** Active */
      active: boolean
      /**
       * Created At
       * Format: date-time
       */
      created_at: string
      /**
       * Updated At
       * Format: date-time
       */
      updated_at: string
    }
    /** AchievementUpdate */
    AchievementUpdate: {
      /** Expected Updated At */
      expected_updated_at?: string | null
      /** Team Id */
      team_id?: string | null
      /** Title */
      title?: string | null
      /** Media Asset Id */
      media_asset_id?: string | null
      /** Achieved At */
      achieved_at?: string | null
      /** Sort Order */
      sort_order?: number | null
      /** Active */
      active?: boolean | null
    }
    /** ApiResponse[AchievementRead] */
    ApiResponse_AchievementRead_: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      data?: components['schemas']['AchievementRead'] | null
    }
    /** ApiResponse[CompetitionImpact] */
    ApiResponse_CompetitionImpact_: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      data?: components['schemas']['CompetitionImpact'] | null
    }
    /** ApiResponse[CompetitionRead] */
    ApiResponse_CompetitionRead_: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      data?: components['schemas']['CompetitionRead'] | null
    }
    /** ApiResponse[ContentList] */
    ApiResponse_ContentList_: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      data?: components['schemas']['ContentList'] | null
    }
    /** ApiResponse[ContentRead] */
    ApiResponse_ContentRead_: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      data?: components['schemas']['ContentRead'] | null
    }
    /** ApiResponse[CsrfData] */
    ApiResponse_CsrfData_: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      data?: components['schemas']['CsrfData'] | null
    }
    /** ApiResponse[HomeData] */
    ApiResponse_HomeData_: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      data?: components['schemas']['HomeData'] | null
    }
    /** ApiResponse[ImportJobRead] */
    ApiResponse_ImportJobRead_: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      data?: components['schemas']['ImportJobRead'] | null
    }
    /** ApiResponse[LoginData] */
    ApiResponse_LoginData_: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      data?: components['schemas']['LoginData'] | null
    }
    /** ApiResponse[LogoutData] */
    ApiResponse_LogoutData_: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      data?: components['schemas']['LogoutData'] | null
    }
    /** ApiResponse[MatchRead] */
    ApiResponse_MatchRead_: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      data?: components['schemas']['MatchRead'] | null
    }
    /** ApiResponse[MediaAssetRead] */
    ApiResponse_MediaAssetRead_: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      data?: components['schemas']['MediaAssetRead'] | null
    }
    /** ApiResponse[MediaUploadRead] */
    ApiResponse_MediaUploadRead_: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      data?: components['schemas']['MediaUploadRead'] | null
    }
    /** ApiResponse[PlayerRead] */
    ApiResponse_PlayerRead_: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      data?: components['schemas']['PlayerRead'] | null
    }
    /** ApiResponse[PublicPlayerRead] */
    ApiResponse_PublicPlayerRead_: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      data?: components['schemas']['PublicPlayerRead'] | null
    }
    /** ApiResponse[RestoreResult] */
    ApiResponse_RestoreResult_: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      data?: components['schemas']['RestoreResult'] | null
    }
    /** ApiResponse[RosterPlayerDetail] */
    ApiResponse_RosterPlayerDetail_: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      data?: components['schemas']['RosterPlayerDetail'] | null
    }
    /** ApiResponse[RosterRead] */
    ApiResponse_RosterRead_: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      data?: components['schemas']['RosterRead'] | null
    }
    /** ApiResponse[StandingsOptions] */
    ApiResponse_StandingsOptions_: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      data?: components['schemas']['StandingsOptions'] | null
    }
    /** ApiResponse[StandingsSnapshotRead] */
    ApiResponse_StandingsSnapshotRead_: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      data?: components['schemas']['StandingsSnapshotRead'] | null
    }
    /** ApiResponse[TeamRead] */
    ApiResponse_TeamRead_: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      data?: components['schemas']['TeamRead'] | null
    }
    /** ApiResponse[TournamentsRead] */
    ApiResponse_TournamentsRead_: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      data?: components['schemas']['TournamentsRead'] | null
    }
    /** ApiResponse[UserRead] */
    ApiResponse_UserRead_: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      data?: components['schemas']['UserRead'] | null
    }
    /** ApiResponse[VenueRead] */
    ApiResponse_VenueRead_: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      data?: components['schemas']['VenueRead'] | null
    }
    /** ApiResponse[dict[str, object]] */
    ApiResponse_dict_str__object__: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      /** Data */
      data?: {
        [key: string]: unknown
      } | null
    }
    /** ApiResponse[list[MediaUsage]] */
    ApiResponse_list_MediaUsage__: {
      /**
       * Status
       * @default success
       */
      status: string
      /** Message */
      message: string
      /** Data */
      data?: components['schemas']['MediaUsage'][] | null
    }
    /** ArchiveResultRead */
    ArchiveResultRead: {
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** External Id */
      external_id: string
      /**
       * Discipline
       * @enum {string}
       */
      discipline: '5x5' | '3x3' | 'phygital'
      /**
       * Team
       * @enum {string}
       */
      team: 'men' | 'women'
      /** Season */
      season: string
      /** Year */
      year: number
      /** Tournament */
      tournament: string
      /** Event Date */
      event_date: string | null
      /** Date Precision */
      date_precision: string
      /** Location */
      location: string | null
      /** Team Name */
      team_name: string
      /** Opponent Name */
      opponent_name: string | null
      /** Club Score */
      club_score: number | null
      /** Opponent Score */
      opponent_score: number | null
      /** Place */
      place: number | null
      /** Status */
      status: string
      /** Source */
      source: string
      /** Source Url */
      source_url: string | null
      /** Source Label */
      source_label: string
      /** Emblem Url */
      emblem_url: string | null
      /** Opponent Emblem Url */
      opponent_emblem_url: string | null
      /** Notes */
      notes: string | null
    }
    /** AsbImportRequest */
    AsbImportRequest: {
      /** Team */
      team: string
      /** Competition Id */
      competition_id: string
      /** Standings Competition Id */
      standings_competition_id?: string | null
      /** External Team Id */
      external_team_id: string
      /** Season */
      season: string
      /**
       * Competition Name
       * @default АСБ
       */
      competition_name: string
    }
    /**
     * AuditAction
     * @enum {string}
     */
    AuditAction: 'create' | 'update' | 'delete' | 'upload' | 'publish' | 'import'
    /** AuditLogRead */
    AuditLogRead: {
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Actor Id */
      actor_id: string | null
      /** Actor Username */
      actor_username: string
      /** Actor Role */
      actor_role: string | null
      action: components['schemas']['AuditAction']
      /** Entity Type */
      entity_type: string
      /** Entity Id */
      entity_id: string
      /** Before */
      before: {
        [key: string]: unknown
      } | null
      /** After */
      after: {
        [key: string]: unknown
      } | null
      /** Request Id */
      request_id: string | null
      /**
       * Created At
       * Format: date-time
       */
      created_at: string
    }
    /** CalendarCounts */
    CalendarCounts: {
      /**
       * Upcoming
       * @default 0
       */
      upcoming: number
      /**
       * Changed
       * @default 0
       */
      changed: number
      /**
       * Results
       * @default 0
       */
      results: number
      /**
       * Awaiting
       * @default 0
       */
      awaiting: number
    }
    /** CalendarEntry */
    CalendarEntry: {
      /**
       * Kind
       * @enum {string}
       */
      kind: 'calendar' | 'archive'
      /**
       * Section
       * @enum {string}
       */
      section: 'upcoming' | 'changed' | 'results' | 'awaiting'
      /** Season */
      season: string
      match?: components['schemas']['MatchRead'] | null
      result?: components['schemas']['ArchiveResultRead'] | null
    }
    /** CalendarPage */
    CalendarPage: {
      /** Items */
      items: components['schemas']['CalendarEntry'][]
      /** Total */
      total: number
      /** Page */
      page: number
      /** Page Size */
      page_size: number
      /** Total Pages */
      total_pages: number
      counts: components['schemas']['CalendarCounts']
      /** Seasons */
      seasons: string[]
      /** Default Season */
      default_season: string
      /** Selected Season */
      selected_season: string
      /**
       * At
       * Format: date-time
       */
      at: string
    }
    /**
     * ClubSide
     * @enum {string}
     */
    ClubSide: 'home' | 'away'
    /** CompetitionCreate */
    CompetitionCreate: {
      /** Name */
      name: string
      /** Season */
      season: string
      /**
       * Source
       * @default manual
       */
      source: string
      /** External Id */
      external_id?: string | null
      /**
       * Active
       * @default true
       */
      active: boolean
    }
    /** CompetitionImpact */
    CompetitionImpact: {
      /** Matches Count */
      matches_count: number
      /** Published Matches Count */
      published_matches_count: number
    }
    /** CompetitionRead */
    CompetitionRead: {
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Name */
      name: string
      /** Season */
      season: string
      /** Source */
      source: string
      /** External Id */
      external_id: string | null
      /** Active */
      active: boolean
      /**
       * Created At
       * Format: date-time
       */
      created_at: string
      /**
       * Updated At
       * Format: date-time
       */
      updated_at: string
    }
    /** CompetitionUpdate */
    CompetitionUpdate: {
      /** Expected Updated At */
      expected_updated_at?: string | null
      /** Name */
      name?: string | null
      /** Season */
      season?: string | null
      /** Source */
      source?: string | null
      /** External Id */
      external_id?: string | null
      /** Active */
      active?: boolean | null
    }
    /** ContentCreate */
    ContentCreate: {
      section: components['schemas']['ContentSection']
      /** Title */
      title: string
      /** Body */
      body: string
      /** Subtitle */
      subtitle?: string | null
      /** Link Url */
      link_url?: string | null
      /** Link Label */
      link_label?: string | null
      /**
       * Sort Order
       * @default 0
       */
      sort_order: number
      /**
       * Active
       * @default true
       */
      active: boolean
    }
    /** ContentList */
    ContentList: {
      /** Items */
      items: components['schemas']['ContentRead'][]
    }
    /** ContentRead */
    ContentRead: {
      /**
       * Id
       * Format: uuid
       */
      id: string
      section: components['schemas']['ContentSection']
      /** Title */
      title: string
      /** Body */
      body: string
      /** Subtitle */
      subtitle?: string | null
      /** Link Url */
      link_url?: string | null
      /** Link Label */
      link_label?: string | null
      /** Sort Order */
      sort_order: number
      /** Active */
      active: boolean
      /**
       * Created At
       * Format: date-time
       */
      created_at: string
      /**
       * Updated At
       * Format: date-time
       */
      updated_at: string
    }
    /**
     * ContentSection
     * @enum {string}
     */
    ContentSection:
      | 'history'
      | 'rules'
      | 'contact_channels'
      | 'captains'
      | 'player_roles'
      | 'viewing_tips'
    /** ContentUpdate */
    ContentUpdate: {
      /** Expected Updated At */
      expected_updated_at?: string | null
      section?: components['schemas']['ContentSection'] | null
      /** Title */
      title?: string | null
      /** Body */
      body?: string | null
      /** Subtitle */
      subtitle?: string | null
      /** Link Url */
      link_url?: string | null
      /** Link Label */
      link_label?: string | null
      /** Sort Order */
      sort_order?: number | null
      /** Active */
      active?: boolean | null
    }
    /** ContextSource */
    ContextSource: {
      /** Url */
      url: string
      /** Label */
      label: string
    }
    /** CsrfData */
    CsrfData: {
      /** Csrf Token */
      csrf_token: string
      /**
       * Expires At
       * Format: date-time
       */
      expires_at: string
    }
    /** HTTPValidationError */
    HTTPValidationError: {
      /** Detail */
      detail?: components['schemas']['ValidationError'][]
    }
    /** HomeData */
    HomeData: {
      /**
       * Generated At
       * Format: date-time
       */
      generated_at: string
      next_match: components['schemas']['MatchRead'] | null
      /** Recent Results */
      recent_results: components['schemas']['MatchRead'][]
      /** Teams */
      teams: components['schemas']['TeamRead'][]
    }
    /** ImportJobRead */
    ImportJobRead: {
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Provider */
      provider: string
      status: components['schemas']['ImportStatus']
      /** Team Slug */
      team_slug: string
      /** Competition External Id */
      competition_external_id: string
      /** Standings External Id */
      standings_external_id: string
      /** External Team Id */
      external_team_id: string
      /** Season */
      season: string
      /** Request Data */
      request_data: {
        [key: string]: unknown
      }
      /** Result */
      result: {
        [key: string]: unknown
      } | null
      /** Error Code */
      error_code: string | null
      /** Error Detail */
      error_detail: string | null
      /** Actor Id */
      actor_id: string | null
      /** Actor Username */
      actor_username: string
      /** Request Id */
      request_id: string | null
      /** Started At */
      started_at: string | null
      /** Completed At */
      completed_at: string | null
      /**
       * Created At
       * Format: date-time
       */
      created_at: string
      /**
       * Updated At
       * Format: date-time
       */
      updated_at: string
    }
    /**
     * ImportStatus
     * @enum {string}
     */
    ImportStatus: 'pending' | 'running' | 'completed' | 'failed'
    /** LoginData */
    LoginData: {
      user: components['schemas']['UserRead']
      /** Csrf Token */
      csrf_token: string
      /**
       * Expires At
       * Format: date-time
       */
      expires_at: string
    }
    /** LoginRequest */
    LoginRequest: {
      /** Username */
      username: string
      /** Password */
      password: string
    }
    /** LogoutData */
    LogoutData: {
      /**
       * Logged Out
       * @default true
       */
      logged_out: boolean
    }
    /** MatchCreate */
    MatchCreate: {
      /**
       * Team Id
       * Format: uuid
       */
      team_id: string
      /**
       * Competition Id
       * Format: uuid
       */
      competition_id: string
      /** Venue Id */
      venue_id?: string | null
      /**
       * Starts At
       * Format: date-time
       */
      starts_at: string
      club_side: components['schemas']['ClubSide']
      /** Home Team Name */
      home_team_name: string
      /** Away Team Name */
      away_team_name: string
      /** Home Score */
      home_score?: number | null
      /** Away Score */
      away_score?: number | null
      /** @default scheduled */
      status: components['schemas']['MatchStatus']
      /**
       * Source
       * @default manual
       */
      source: string
      /** External Id */
      external_id?: string | null
      /** Home Logo Asset Id */
      home_logo_asset_id?: string | null
      /** Away Logo Asset Id */
      away_logo_asset_id?: string | null
      /** Notes */
      notes?: string | null
      /**
       * Featured
       * @default false
       */
      featured: boolean
      /**
       * Active
       * @default true
       */
      active: boolean
    }
    /** MatchRead */
    MatchRead: {
      /**
       * Id
       * Format: uuid
       */
      id: string
      /**
       * Team Id
       * Format: uuid
       */
      team_id: string
      team: components['schemas']['TeamSummary']
      /**
       * Competition Id
       * Format: uuid
       */
      competition_id: string
      competition: components['schemas']['CompetitionRead']
      /** Venue Id */
      venue_id: string | null
      venue: components['schemas']['VenueRead'] | null
      /**
       * Starts At
       * Format: date-time
       */
      starts_at: string
      club_side: components['schemas']['ClubSide']
      /** Home Team Name */
      home_team_name: string
      /** Away Team Name */
      away_team_name: string
      /** Home Score */
      home_score: number | null
      /** Away Score */
      away_score: number | null
      status: components['schemas']['MatchStatus']
      /** Source */
      source: string
      /** External Id */
      external_id: string | null
      /** Home Logo Asset Id */
      home_logo_asset_id: string | null
      /** Away Logo Asset Id */
      away_logo_asset_id: string | null
      home_logo: components['schemas']['MediaAssetRead'] | null
      away_logo: components['schemas']['MediaAssetRead'] | null
      /** Home Logo Url */
      home_logo_url: string | null
      /** Away Logo Url */
      away_logo_url: string | null
      /** Notes */
      notes: string | null
      /** Active */
      active: boolean
      /** Featured */
      featured: boolean
      /**
       * Created At
       * Format: date-time
       */
      created_at: string
      /**
       * Updated At
       * Format: date-time
       */
      updated_at: string
    }
    /**
     * MatchStatus
     * @enum {string}
     */
    MatchStatus: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled'
    /** MatchUpdate */
    MatchUpdate: {
      /** Expected Updated At */
      expected_updated_at?: string | null
      /** Team Id */
      team_id?: string | null
      /** Competition Id */
      competition_id?: string | null
      /** Venue Id */
      venue_id?: string | null
      /** Starts At */
      starts_at?: string | null
      club_side?: components['schemas']['ClubSide'] | null
      /** Home Team Name */
      home_team_name?: string | null
      /** Away Team Name */
      away_team_name?: string | null
      /** Home Score */
      home_score?: number | null
      /** Away Score */
      away_score?: number | null
      status?: components['schemas']['MatchStatus'] | null
      /** Source */
      source?: string | null
      /** External Id */
      external_id?: string | null
      /** Home Logo Asset Id */
      home_logo_asset_id?: string | null
      /** Away Logo Asset Id */
      away_logo_asset_id?: string | null
      /** Notes */
      notes?: string | null
      /** Featured */
      featured?: boolean | null
      /** Active */
      active?: boolean | null
    }
    /** MediaAssetRead */
    MediaAssetRead: {
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Mime */
      mime: string
      /** Size */
      size: number
      /** Width */
      width: number | null
      /** Height */
      height: number | null
      /** Alt Text */
      alt_text: string | null
      /**
       * Created At
       * Format: date-time
       */
      created_at: string
      /**
       * Updated At
       * Format: date-time
       */
      updated_at: string
      /** Content Url */
      readonly content_url: string
    }
    /** MediaUpdate */
    MediaUpdate: {
      /** Expected Updated At */
      expected_updated_at?: string | null
      /** Alt Text */
      alt_text?: string | null
    }
    /** MediaUploadRead */
    MediaUploadRead: {
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Mime */
      mime: string
      /** Size */
      size: number
      /** Width */
      width: number | null
      /** Height */
      height: number | null
      /** Alt Text */
      alt_text: string | null
      /**
       * Created At
       * Format: date-time
       */
      created_at: string
      /**
       * Updated At
       * Format: date-time
       */
      updated_at: string
      /**
       * Reused
       * @default false
       */
      reused: boolean
      /** Content Url */
      readonly content_url: string
    }
    /** MediaUsage */
    MediaUsage: {
      /** Entity Type */
      entity_type: string
      /** Entity Id */
      entity_id: string
      /** Title */
      title: string
      /** Field */
      field: string
      /** Admin Url */
      admin_url: string
      /** Public Url */
      public_url: string | null
    }
    /** PaginatedResponse[AchievementRead] */
    PaginatedResponse_AchievementRead_: {
      /** Items */
      items: components['schemas']['AchievementRead'][]
      /** Total */
      total: number
      /** Page */
      page: number
      /** Page Size */
      page_size: number
      /** Total Pages */
      total_pages: number
    }
    /** PaginatedResponse[ArchiveResultRead] */
    PaginatedResponse_ArchiveResultRead_: {
      /** Items */
      items: components['schemas']['ArchiveResultRead'][]
      /** Total */
      total: number
      /** Page */
      page: number
      /** Page Size */
      page_size: number
      /** Total Pages */
      total_pages: number
    }
    /** PaginatedResponse[AuditLogRead] */
    PaginatedResponse_AuditLogRead_: {
      /** Items */
      items: components['schemas']['AuditLogRead'][]
      /** Total */
      total: number
      /** Page */
      page: number
      /** Page Size */
      page_size: number
      /** Total Pages */
      total_pages: number
    }
    /** PaginatedResponse[CompetitionRead] */
    PaginatedResponse_CompetitionRead_: {
      /** Items */
      items: components['schemas']['CompetitionRead'][]
      /** Total */
      total: number
      /** Page */
      page: number
      /** Page Size */
      page_size: number
      /** Total Pages */
      total_pages: number
    }
    /** PaginatedResponse[ContentRead] */
    PaginatedResponse_ContentRead_: {
      /** Items */
      items: components['schemas']['ContentRead'][]
      /** Total */
      total: number
      /** Page */
      page: number
      /** Page Size */
      page_size: number
      /** Total Pages */
      total_pages: number
    }
    /** PaginatedResponse[ImportJobRead] */
    PaginatedResponse_ImportJobRead_: {
      /** Items */
      items: components['schemas']['ImportJobRead'][]
      /** Total */
      total: number
      /** Page */
      page: number
      /** Page Size */
      page_size: number
      /** Total Pages */
      total_pages: number
    }
    /** PaginatedResponse[MatchRead] */
    PaginatedResponse_MatchRead_: {
      /** Items */
      items: components['schemas']['MatchRead'][]
      /** Total */
      total: number
      /** Page */
      page: number
      /** Page Size */
      page_size: number
      /** Total Pages */
      total_pages: number
    }
    /** PaginatedResponse[MediaAssetRead] */
    PaginatedResponse_MediaAssetRead_: {
      /** Items */
      items: components['schemas']['MediaAssetRead'][]
      /** Total */
      total: number
      /** Page */
      page: number
      /** Page Size */
      page_size: number
      /** Total Pages */
      total_pages: number
    }
    /** PaginatedResponse[PlayerRead] */
    PaginatedResponse_PlayerRead_: {
      /** Items */
      items: components['schemas']['PlayerRead'][]
      /** Total */
      total: number
      /** Page */
      page: number
      /** Page Size */
      page_size: number
      /** Total Pages */
      total_pages: number
    }
    /** PaginatedResponse[PublicPlayerRead] */
    PaginatedResponse_PublicPlayerRead_: {
      /** Items */
      items: components['schemas']['PublicPlayerRead'][]
      /** Total */
      total: number
      /** Page */
      page: number
      /** Page Size */
      page_size: number
      /** Total Pages */
      total_pages: number
    }
    /** PaginatedResponse[StandingsSnapshotRead] */
    PaginatedResponse_StandingsSnapshotRead_: {
      /** Items */
      items: components['schemas']['StandingsSnapshotRead'][]
      /** Total */
      total: number
      /** Page */
      page: number
      /** Page Size */
      page_size: number
      /** Total Pages */
      total_pages: number
    }
    /** PaginatedResponse[TeamRead] */
    PaginatedResponse_TeamRead_: {
      /** Items */
      items: components['schemas']['TeamRead'][]
      /** Total */
      total: number
      /** Page */
      page: number
      /** Page Size */
      page_size: number
      /** Total Pages */
      total_pages: number
    }
    /** PaginatedResponse[TrashItem] */
    PaginatedResponse_TrashItem_: {
      /** Items */
      items: components['schemas']['TrashItem'][]
      /** Total */
      total: number
      /** Page */
      page: number
      /** Page Size */
      page_size: number
      /** Total Pages */
      total_pages: number
    }
    /** PaginatedResponse[VenueRead] */
    PaginatedResponse_VenueRead_: {
      /** Items */
      items: components['schemas']['VenueRead'][]
      /** Total */
      total: number
      /** Page */
      page: number
      /** Page Size */
      page_size: number
      /** Total Pages */
      total_pages: number
    }
    /** PlayerCreate */
    PlayerCreate: {
      /**
       * Team Id
       * Format: uuid
       */
      team_id: string
      /** Full Name */
      full_name: string
      /** Birth Date */
      birth_date?: string | null
      /** Age Text */
      age_text?: string | null
      /** Position */
      position?: string | null
      /** Fact */
      fact?: string | null
      /** Photo Asset Id */
      photo_asset_id?: string | null
      /**
       * Sort Order
       * @default 0
       */
      sort_order: number
      /**
       * Active
       * @default true
       */
      active: boolean
    }
    /** PlayerRead */
    PlayerRead: {
      /**
       * Id
       * Format: uuid
       */
      id: string
      /**
       * Team Id
       * Format: uuid
       */
      team_id: string
      team: components['schemas']['TeamSummary']
      /** Full Name */
      full_name: string
      /** Age Text */
      age_text: string | null
      /** Position */
      position: string | null
      /** Fact */
      fact: string | null
      /** Photo Asset Id */
      photo_asset_id: string | null
      photo: components['schemas']['MediaAssetRead'] | null
      /** Sort Order */
      sort_order: number
      /** Active */
      active: boolean
      /**
       * Created At
       * Format: date-time
       */
      created_at: string
      /**
       * Updated At
       * Format: date-time
       */
      updated_at: string
      /** Birth Date */
      birth_date: string | null
    }
    /** PlayerUpdate */
    PlayerUpdate: {
      /** Expected Updated At */
      expected_updated_at?: string | null
      /** Team Id */
      team_id?: string | null
      /** Full Name */
      full_name?: string | null
      /** Birth Date */
      birth_date?: string | null
      /** Age Text */
      age_text?: string | null
      /** Position */
      position?: string | null
      /** Fact */
      fact?: string | null
      /** Photo Asset Id */
      photo_asset_id?: string | null
      /** Sort Order */
      sort_order?: number | null
      /** Active */
      active?: boolean | null
    }
    /** PublicPlayerRead */
    PublicPlayerRead: {
      /**
       * Id
       * Format: uuid
       */
      id: string
      /**
       * Team Id
       * Format: uuid
       */
      team_id: string
      team: components['schemas']['TeamSummary']
      /** Full Name */
      full_name: string
      /** Age Text */
      age_text: string | null
      /** Position */
      position: string | null
      /** Fact */
      fact: string | null
      /** Photo Asset Id */
      photo_asset_id: string | null
      photo: components['schemas']['MediaAssetRead'] | null
      /** Sort Order */
      sort_order: number
      /** Active */
      active: boolean
      /**
       * Created At
       * Format: date-time
       */
      created_at: string
      /**
       * Updated At
       * Format: date-time
       */
      updated_at: string
    }
    /** RestoreRequest */
    RestoreRequest: {
      /**
       * Expected Updated At
       * Format: date-time
       */
      expected_updated_at: string
    }
    /** RestoreResult */
    RestoreResult: {
      /**
       * Id
       * Format: uuid
       */
      id: string
      entity: components['schemas']['TrashEntity']
      /** Restored */
      restored: boolean
      /**
       * Publication State
       * @enum {string}
       */
      publication_state: 'hidden' | 'private'
      /** Message */
      message: string
    }
    /** RosterPlayerDetail */
    RosterPlayerDetail: {
      /** Team */
      team: string
      /** Current Season */
      current_season: string
      /** Season */
      season: string | null
      /** Latest Published Season */
      latest_published_season: string | null
      /** Is Current Season */
      is_current_season: boolean
      /**
       * Status
       * @enum {string}
       */
      status: 'published' | 'not_published'
      /**
       * Selection
       * @enum {string}
       */
      selection: 'current' | 'latest_published'
      /** Notice */
      notice: string | null
      /** Source Url */
      source_url: string | null
      /** Stats Source Url */
      stats_source_url: string | null
      /** Fetched At */
      fetched_at: string | null
      player: components['schemas']['RosterPlayerRead']
    }
    /** RosterPlayerRead */
    RosterPlayerRead: {
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** External Player Id */
      external_player_id: string
      /** Full Name */
      full_name: string
      /** Photo Url */
      photo_url: string | null
      /** Games Played */
      games_played: number | null
      /** Points Per Game */
      points_per_game: number | null
      /** Assists Per Game */
      assists_per_game: number | null
      /** Rebounds Per Game */
      rebounds_per_game: number | null
      /** Minutes Per Game */
      minutes_per_game: number | null
      /** Statistics Season */
      statistics_season: string | null
      /** Statistics Source Url */
      statistics_source_url: string | null
    }
    /** RosterRead */
    RosterRead: {
      /** Team */
      team: string
      /** Current Season */
      current_season: string
      /** Season */
      season: string | null
      /** Latest Published Season */
      latest_published_season: string | null
      /** Is Current Season */
      is_current_season: boolean
      /**
       * Status
       * @enum {string}
       */
      status: 'published' | 'not_published'
      /**
       * Selection
       * @enum {string}
       */
      selection: 'current' | 'latest_published'
      /** Notice */
      notice: string | null
      /** Source Url */
      source_url: string | null
      /** Stats Source Url */
      stats_source_url: string | null
      /** Fetched At */
      fetched_at: string | null
      /** Players */
      players: components['schemas']['RosterPlayerRead'][]
    }
    /** StandingRow */
    'StandingRow-Input': {
      /** Position */
      position: number
      /** Team Name */
      team_name: string
      /** External Team Id */
      external_team_id?: string | null
      /** Team Logo Url */
      team_logo_url?: string | null
      /** Played */
      played: number
      /** Wins */
      wins: number
      /** Losses */
      losses: number
      /**
       * Draws
       * @default 0
       */
      draws: number
      /** Table Points */
      table_points: number
      /** Points For */
      points_for: number
      /** Points Against */
      points_against: number
    }
    /** StandingRow */
    'StandingRow-Output': {
      /** Position */
      position: number
      /** Team Name */
      team_name: string
      /** External Team Id */
      external_team_id?: string | null
      /** Team Logo Url */
      team_logo_url?: string | null
      /** Played */
      played: number
      /** Wins */
      wins: number
      /** Losses */
      losses: number
      /**
       * Draws
       * @default 0
       */
      draws: number
      /** Table Points */
      table_points: number
      /** Points For */
      points_for: number
      /** Points Against */
      points_against: number
      /** Points Difference */
      readonly points_difference: number
    }
    /** StandingsCompetitionOption */
    StandingsCompetitionOption: {
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Name */
      name: string
      /** Season */
      season: string
      /**
       * Snapshot Id
       * Format: uuid
       */
      snapshot_id: string
      /** Row Count */
      row_count: number
      /** Source */
      source: string
      /** Source Reference */
      source_reference: string | null
      /** Source Url */
      source_url: string | null
      /** Tournament Id */
      tournament_id?: string | null
      /** Tournament Name */
      tournament_name?: string | null
      /** Stage Name */
      stage_name?: string | null
      /**
       * Stage Kind
       * @default other
       */
      stage_kind: string
      /**
       * Game Count
       * @default 0
       */
      game_count: number
    }
    /** StandingsGame */
    StandingsGame: {
      /** External Id */
      external_id: string
      /** Round Name */
      round_name: string
      /** Round */
      round?: number | null
      /** Tree */
      tree?: number | null
      /**
       * Sort Order
       * @default 0
       */
      sort_order: number
      /** Starts At */
      starts_at?: string | null
      /**
       * Date Precision
       * @default day
       * @enum {string}
       */
      date_precision: 'day' | 'time'
      /** Home Team Name */
      home_team_name: string
      /** Home Team Id */
      home_team_id?: string | null
      /** Home Team Logo Url */
      home_team_logo_url?: string | null
      /** Away Team Name */
      away_team_name: string
      /** Away Team Id */
      away_team_id?: string | null
      /** Away Team Logo Url */
      away_team_logo_url?: string | null
      /** Home Score */
      home_score?: number | null
      /** Away Score */
      away_score?: number | null
      /**
       * Status
       * @enum {string}
       */
      status: 'finished' | 'scheduled' | 'unpublished'
      /**
       * Source Url
       * Format: uri
       */
      source_url: string
    }
    /** StandingsOptions */
    StandingsOptions: {
      /** Team */
      team: string
      /** Seasons */
      seasons: string[]
      /** Competitions */
      competitions: components['schemas']['StandingsCompetitionOption'][]
      /** Default Competition Id */
      default_competition_id: string | null
    }
    /** StandingsPublish */
    StandingsPublish: {
      /**
       * Team Id
       * Format: uuid
       */
      team_id: string
      /**
       * Competition Id
       * Format: uuid
       */
      competition_id: string
      /** Rows */
      rows: components['schemas']['StandingRow-Input'][]
      /**
       * Source
       * @default manual
       */
      source: string
      /** Source Reference */
      source_reference?: string | null
      /**
       * Fetched At
       * Format: date-time
       */
      fetched_at?: string
    }
    /** StandingsSnapshotRead */
    StandingsSnapshotRead: {
      /**
       * Id
       * Format: uuid
       */
      id: string
      /**
       * Team Id
       * Format: uuid
       */
      team_id: string
      team: components['schemas']['TeamSummary']
      /**
       * Competition Id
       * Format: uuid
       */
      competition_id: string
      competition: components['schemas']['CompetitionRead']
      /** Rows */
      rows: components['schemas']['StandingRow-Output'][]
      /** Source */
      source: string
      /** Source Reference */
      source_reference: string | null
      /** Source Url */
      source_url: string | null
      /** Last Game At */
      last_game_at: string | null
      /** Stage Order */
      stage_order: number
      /** Tournament Id */
      tournament_id?: string | null
      /** Tournament Name */
      tournament_name?: string | null
      /** Stage Name */
      stage_name?: string | null
      /**
       * Stage Kind
       * @default other
       */
      stage_kind: string
      /** Games */
      games?: components['schemas']['StandingsGame'][]
      /**
       * Fetched At
       * Format: date-time
       */
      fetched_at: string
      /** Is Current */
      is_current: boolean
      /**
       * Created At
       * Format: date-time
       */
      created_at: string
      /**
       * Updated At
       * Format: date-time
       */
      updated_at: string
    }
    /**
     * TeamCategory
     * @enum {string}
     */
    TeamCategory: 'men' | 'women'
    /** TeamRead */
    TeamRead: {
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Slug */
      slug: string
      /** Name */
      name: string
      category: components['schemas']['TeamCategory']
      /** Active */
      active: boolean
      logo: components['schemas']['MediaAssetRead'] | null
      /** Logo Asset Id */
      logo_asset_id: string | null
      /**
       * Created At
       * Format: date-time
       */
      created_at: string
      /**
       * Updated At
       * Format: date-time
       */
      updated_at: string
    }
    /** TeamSummary */
    TeamSummary: {
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Slug */
      slug: string
      /** Name */
      name: string
      category: components['schemas']['TeamCategory']
      /** Active */
      active: boolean
      logo: components['schemas']['MediaAssetRead'] | null
    }
    /** TeamUpdate */
    TeamUpdate: {
      /** Expected Updated At */
      expected_updated_at?: string | null
      /** Name */
      name?: string | null
      /** Logo Asset Id */
      logo_asset_id?: string | null
      /** Active */
      active?: boolean | null
    }
    /** TournamentRead */
    TournamentRead: {
      /** Key */
      key: string
      /** Name */
      name: string
      /** Match Terms */
      match_terms: string[]
      /** Description */
      description: string
      /** Organizer */
      organizer: string
      /** Official Url */
      official_url: string | null
      /** Logo Url */
      logo_url: string | null
      /** Logo Alt */
      logo_alt: string
      /** Logo Scope */
      logo_scope: string
      /** Sources */
      sources: components['schemas']['ContextSource'][]
      /** Results */
      results: components['schemas']['ArchiveResultRead'][]
    }
    /** TournamentsRead */
    TournamentsRead: {
      /** Items */
      items: components['schemas']['TournamentRead'][]
      /** Result Count */
      result_count: number
    }
    /**
     * TrashEntity
     * @enum {string}
     */
    TrashEntity:
      | 'players'
      | 'achievements'
      | 'content'
      | 'competitions'
      | 'venues'
      | 'matches'
      | 'media'
    /** TrashItem */
    TrashItem: {
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Title */
      title: string
      /** Detail */
      detail?: string | null
      /** Deleted At */
      deleted_at: string | null
      /**
       * Updated At
       * Format: date-time
       */
      updated_at: string
    }
    /** UserRead */
    UserRead: {
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Username */
      username: string
      /** Email */
      email: string
      role: components['schemas']['UserRole']
      /** First Name */
      first_name: string | null
      /** Last Name */
      last_name: string | null
    }
    /**
     * UserRole
     * @enum {string}
     */
    UserRole: 'USER' | 'EDITOR' | 'ADMIN'
    /** ValidationError */
    ValidationError: {
      /** Location */
      loc: (string | number)[]
      /** Message */
      msg: string
      /** Error Type */
      type: string
      /** Input */
      input?: unknown
      /** Context */
      ctx?: Record<string, never>
    }
    /** VenueCreate */
    VenueCreate: {
      /** Name */
      name: string
      /** Address */
      address: string
      /** Latitude */
      latitude?: number | null
      /** Longitude */
      longitude?: number | null
      /** Description */
      description?: string | null
      /**
       * Source
       * @default manual
       */
      source: string
      /** External Id */
      external_id?: string | null
      /**
       * Active
       * @default true
       */
      active: boolean
    }
    /** VenueRead */
    VenueRead: {
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Name */
      name: string
      /** Address */
      address: string
      /** Latitude */
      latitude: number | null
      /** Longitude */
      longitude: number | null
      /** Description */
      description: string | null
      /** Source */
      source: string
      /** External Id */
      external_id: string | null
      /** Active */
      active: boolean
      /**
       * Created At
       * Format: date-time
       */
      created_at: string
      /**
       * Updated At
       * Format: date-time
       */
      updated_at: string
    }
    /** VenueUpdate */
    VenueUpdate: {
      /** Expected Updated At */
      expected_updated_at?: string | null
      /** Name */
      name?: string | null
      /** Address */
      address?: string | null
      /** Latitude */
      latitude?: number | null
      /** Longitude */
      longitude?: number | null
      /** Description */
      description?: string | null
      /** Source */
      source?: string | null
      /** External Id */
      external_id?: string | null
      /** Active */
      active?: boolean | null
    }
  }
  responses: never
  parameters: never
  requestBodies: never
  headers: never
  pathItems: never
}
export type $defs = Record<string, never>
export interface operations {
  live_health_live_get: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': {
            [key: string]: string
          }
        }
      }
    }
  }
  ready_health_ready_get: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': {
            [key: string]: string
          }
        }
      }
    }
  }
  get_media_content_media__asset_id__content_get: {
    parameters: {
      query?: never
      header?: never
      path: {
        asset_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  login_api_v1_auth_login_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['LoginRequest']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_LoginData_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  logout_api_v1_auth_logout_post: {
    parameters: {
      query?: never
      header?: {
        'X-CSRF-Token'?: string | null
      }
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_LogoutData_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  issue_csrf_token_api_v1_auth_csrf_get: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_CsrfData_']
        }
      }
    }
  }
  me_api_v1_auth_me_get: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_UserRead_']
        }
      }
    }
  }
  list_teams_api_v1_teams_get: {
    parameters: {
      query?: {
        page?: number
        page_size?: number
        category?: components['schemas']['TeamCategory'] | null
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PaginatedResponse_TeamRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_players_api_v1_players_get: {
    parameters: {
      query?: {
        page?: number
        page_size?: number
        team?: string | null
        category?: components['schemas']['TeamCategory'] | null
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PaginatedResponse_PublicPlayerRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_player_api_v1_players__player_id__get: {
    parameters: {
      query?: never
      header?: never
      path: {
        player_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_PublicPlayerRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_admin_players_api_v1_admin_players_get: {
    parameters: {
      query?: {
        q?: string | null
        page?: number
        page_size?: number
        team?: string | null
        category?: components['schemas']['TeamCategory'] | null
        active?: boolean | null
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PaginatedResponse_PlayerRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  create_player_api_v1_admin_players_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['PlayerCreate']
      }
    }
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_PlayerRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_admin_player_api_v1_admin_players__player_id__get: {
    parameters: {
      query?: never
      header?: never
      path: {
        player_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_PlayerRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  delete_player_api_v1_admin_players__player_id__delete: {
    parameters: {
      query?: {
        expected_updated_at?: string | null
      }
      header?: never
      path: {
        player_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      204: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  update_player_api_v1_admin_players__player_id__patch: {
    parameters: {
      query?: never
      header?: never
      path: {
        player_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['PlayerUpdate']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_PlayerRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_admin_teams_api_v1_admin_teams_get: {
    parameters: {
      query?: {
        q?: string | null
        page?: number
        page_size?: number
        active?: boolean | null
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PaginatedResponse_TeamRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_admin_team_api_v1_admin_teams__team_id__get: {
    parameters: {
      query?: never
      header?: never
      path: {
        team_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_TeamRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  update_admin_team_api_v1_admin_teams__team_id__patch: {
    parameters: {
      query?: never
      header?: never
      path: {
        team_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['TeamUpdate']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_TeamRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_public_content_api_v1_content__section__get: {
    parameters: {
      query?: never
      header?: never
      path: {
        section: components['schemas']['ContentSection']
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_ContentList_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_admin_content_api_v1_admin_content_get: {
    parameters: {
      query?: {
        section?: components['schemas']['ContentSection'] | null
        q?: string | null
        active?: boolean | null
        page?: number
        page_size?: number
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PaginatedResponse_ContentRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  create_content_api_v1_admin_content_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['ContentCreate']
      }
    }
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_ContentRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_admin_content_api_v1_admin_content__block_id__get: {
    parameters: {
      query?: never
      header?: never
      path: {
        block_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_ContentRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  delete_content_api_v1_admin_content__block_id__delete: {
    parameters: {
      query?: {
        expected_updated_at?: string | null
      }
      header?: never
      path: {
        block_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      204: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  update_content_api_v1_admin_content__block_id__patch: {
    parameters: {
      query?: never
      header?: never
      path: {
        block_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['ContentUpdate']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_ContentRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_competitions_api_v1_competitions_get: {
    parameters: {
      query?: {
        page?: number
        page_size?: number
        season?: string | null
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PaginatedResponse_CompetitionRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_venues_api_v1_venues_get: {
    parameters: {
      query?: {
        page?: number
        page_size?: number
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PaginatedResponse_VenueRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_matches_api_v1_matches_get: {
    parameters: {
      query?: {
        page?: number
        page_size?: number
        team?: string | null
        status?: components['schemas']['MatchStatus'] | null
        from?: string | null
        to?: string | null
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PaginatedResponse_MatchRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_match_api_v1_matches__match_id__get: {
    parameters: {
      query?: never
      header?: never
      path: {
        match_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_MatchRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_admin_competitions_api_v1_admin_competitions_get: {
    parameters: {
      query?: {
        q?: string | null
        page?: number
        page_size?: number
        season?: string | null
        active?: boolean | null
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PaginatedResponse_CompetitionRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  create_competition_api_v1_admin_competitions_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['CompetitionCreate']
      }
    }
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_CompetitionRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_admin_competition_api_v1_admin_competitions__competition_id__get: {
    parameters: {
      query?: never
      header?: never
      path: {
        competition_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_CompetitionRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  delete_competition_api_v1_admin_competitions__competition_id__delete: {
    parameters: {
      query?: {
        expected_updated_at?: string | null
      }
      header?: never
      path: {
        competition_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      204: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  update_competition_api_v1_admin_competitions__competition_id__patch: {
    parameters: {
      query?: never
      header?: never
      path: {
        competition_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['CompetitionUpdate']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_CompetitionRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_admin_venues_api_v1_admin_venues_get: {
    parameters: {
      query?: {
        q?: string | null
        page?: number
        page_size?: number
        active?: boolean | null
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PaginatedResponse_VenueRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  create_venue_api_v1_admin_venues_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['VenueCreate']
      }
    }
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_VenueRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_admin_venue_api_v1_admin_venues__venue_id__get: {
    parameters: {
      query?: never
      header?: never
      path: {
        venue_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_VenueRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  delete_venue_api_v1_admin_venues__venue_id__delete: {
    parameters: {
      query?: {
        expected_updated_at?: string | null
      }
      header?: never
      path: {
        venue_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      204: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  update_venue_api_v1_admin_venues__venue_id__patch: {
    parameters: {
      query?: never
      header?: never
      path: {
        venue_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['VenueUpdate']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_VenueRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_admin_matches_api_v1_admin_matches_get: {
    parameters: {
      query?: {
        q?: string | null
        page?: number
        page_size?: number
        team?: string | null
        competition_id?: string | null
        status?: components['schemas']['MatchStatus'] | null
        from?: string | null
        to?: string | null
        featured?: boolean | null
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PaginatedResponse_MatchRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  create_match_api_v1_admin_matches_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['MatchCreate']
      }
    }
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_MatchRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_admin_match_api_v1_admin_matches__match_id__get: {
    parameters: {
      query?: never
      header?: never
      path: {
        match_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_MatchRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  delete_match_api_v1_admin_matches__match_id__delete: {
    parameters: {
      query?: {
        expected_updated_at?: string | null
      }
      header?: never
      path: {
        match_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      204: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  update_match_api_v1_admin_matches__match_id__patch: {
    parameters: {
      query?: never
      header?: never
      path: {
        match_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['MatchUpdate']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_MatchRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_competition_impact_api_v1_admin_competitions__competition_id__impact_get: {
    parameters: {
      query?: never
      header?: never
      path: {
        competition_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_CompetitionImpact_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_legacy_media_content_api_v1_media__asset_id__content_get: {
    parameters: {
      query?: never
      header?: never
      path: {
        asset_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_admin_media_api_v1_admin_media_get: {
    parameters: {
      query?: {
        q?: string | null
        page?: number
        page_size?: number
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PaginatedResponse_MediaAssetRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  upload_media_api_v1_admin_media_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'multipart/form-data': {
          /** Format: binary */
          file: string
          alt_text?: string
        }
      }
    }
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_MediaUploadRead_']
        }
      }
    }
  }
  get_admin_media_api_v1_admin_media__asset_id__get: {
    parameters: {
      query?: never
      header?: never
      path: {
        asset_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_MediaAssetRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  delete_media_api_v1_admin_media__asset_id__delete: {
    parameters: {
      query?: {
        expected_updated_at?: string | null
      }
      header?: never
      path: {
        asset_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      204: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  update_media_api_v1_admin_media__asset_id__patch: {
    parameters: {
      query?: never
      header?: never
      path: {
        asset_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['MediaUpdate']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_MediaAssetRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_media_usage_api_v1_admin_media__asset_id__usage_get: {
    parameters: {
      query?: never
      header?: never
      path: {
        asset_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_list_MediaUsage__']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_achievements_api_v1_achievements_get: {
    parameters: {
      query?: {
        page?: number
        page_size?: number
        team?: string | null
        category?: components['schemas']['TeamCategory'] | null
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PaginatedResponse_AchievementRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_achievement_api_v1_achievements__achievement_id__get: {
    parameters: {
      query?: never
      header?: never
      path: {
        achievement_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_AchievementRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_admin_achievements_api_v1_admin_achievements_get: {
    parameters: {
      query?: {
        q?: string | null
        page?: number
        page_size?: number
        team?: string | null
        category?: components['schemas']['TeamCategory'] | null
        active?: boolean | null
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PaginatedResponse_AchievementRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  create_achievement_api_v1_admin_achievements_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['AchievementCreate']
      }
    }
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_AchievementRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_admin_achievement_api_v1_admin_achievements__achievement_id__get: {
    parameters: {
      query?: never
      header?: never
      path: {
        achievement_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_AchievementRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  delete_achievement_api_v1_admin_achievements__achievement_id__delete: {
    parameters: {
      query?: {
        expected_updated_at?: string | null
      }
      header?: never
      path: {
        achievement_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      204: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  update_achievement_api_v1_admin_achievements__achievement_id__patch: {
    parameters: {
      query?: never
      header?: never
      path: {
        achievement_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['AchievementUpdate']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_AchievementRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_standings_logo_api_v1_standings_logos__key__webp_get: {
    parameters: {
      query?: never
      header?: never
      path: {
        key: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_standings_options_api_v1_standings_options_get: {
    parameters: {
      query: {
        team: string
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_StandingsOptions_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_standings_api_v1_standings_get: {
    parameters: {
      query: {
        team: string
        season?: string | null
        competition_id?: string | null
        tournament_id?: string | null
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_StandingsSnapshotRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_admin_standings_api_v1_admin_standings_get: {
    parameters: {
      query?: {
        page?: number
        page_size?: number
        team?: string | null
        season?: string | null
        current?: boolean | null
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PaginatedResponse_StandingsSnapshotRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  publish_standings_api_v1_admin_standings_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['StandingsPublish']
      }
    }
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_StandingsSnapshotRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_admin_standings_api_v1_admin_standings__snapshot_id__get: {
    parameters: {
      query?: never
      header?: never
      path: {
        snapshot_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_StandingsSnapshotRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  delete_standings_api_v1_admin_standings__snapshot_id__delete: {
    parameters: {
      query?: never
      header?: never
      path: {
        snapshot_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      204: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_audit_log_api_v1_admin_audit_log_get: {
    parameters: {
      query?: {
        page?: number
        page_size?: number
        actor_id?: string | null
        action?: components['schemas']['AuditAction'] | null
        entity_type?: string | null
        entity_id?: string | null
        from?: string | null
        to?: string | null
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PaginatedResponse_AuditLogRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_import_jobs_api_v1_admin_imports_get: {
    parameters: {
      query?: {
        page?: number
        page_size?: number
        status?: components['schemas']['ImportStatus'] | null
        team?: string | null
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PaginatedResponse_ImportJobRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  import_asb_api_v1_admin_imports_asb_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['AsbImportRequest']
      }
    }
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_ImportJobRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_import_job_api_v1_admin_imports__job_id__get: {
    parameters: {
      query?: never
      header?: never
      path: {
        job_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_ImportJobRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_home_api_v1_home_get: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_HomeData_']
        }
      }
    }
  }
  calendar_api_v1_calendar_get: {
    parameters: {
      query?: {
        team?: ('men' | 'women') | null
        discipline?: ('5x5' | '3x3' | 'phygital') | null
        status?:
          | (
              | 'scheduled'
              | 'live'
              | 'finished'
              | 'postponed'
              | 'cancelled'
              | 'unpublished'
              | 'participated'
            )
          | null
        season?: string | null
        page?: number
        page_size?: number
        at?: string | null
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['CalendarPage']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_deleted_api_v1_admin_trash__entity__get: {
    parameters: {
      query?: {
        q?: string | null
        section?: components['schemas']['ContentSection'] | null
        page?: number
        page_size?: number
      }
      header?: never
      path: {
        entity: components['schemas']['TrashEntity']
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PaginatedResponse_TrashItem_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  restore_deleted_api_v1_admin_trash__entity___record_id__restore_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        entity: components['schemas']['TrashEntity']
        record_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['RestoreRequest']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_RestoreResult_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  club_honours_api_v1_results_archive_honours_get: {
    parameters: {
      query?: {
        team?: ('men' | 'women') | null
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_dict_str__object__']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  archive_summary_api_v1_results_archive_summary_get: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_dict_str__object__']
        }
      }
    }
  }
  list_archive_api_v1_results_archive_get: {
    parameters: {
      query?: {
        discipline?: ('5x5' | '3x3' | 'phygital') | null
        team?: ('men' | 'women') | null
        season?: string | null
        year?: number | null
        page?: number
        page_size?: number
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PaginatedResponse_ArchiveResultRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  club_tournaments_api_v1_results_archive_tournaments_get: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_TournamentsRead_']
        }
      }
    }
  }
  get_roster_api_v1_asb_roster__team__get: {
    parameters: {
      query?: {
        selection?: 'current' | 'latest_published'
      }
      header?: never
      path: {
        team: 'men' | 'women'
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_RosterRead_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_roster_player_api_v1_asb_roster__team__players__player_id__get: {
    parameters: {
      query?: {
        selection?: 'current' | 'latest_published'
      }
      header?: never
      path: {
        team: 'men' | 'women'
        player_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ApiResponse_RosterPlayerDetail_']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_roster_player_photo_api_v1_asb_roster__team__players__player_id__photo_get: {
    parameters: {
      query?: never
      header?: never
      path: {
        team: 'men' | 'women'
        player_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content?: never
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
}
