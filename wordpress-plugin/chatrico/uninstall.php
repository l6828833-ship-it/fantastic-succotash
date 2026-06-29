<?php
/**
 * Runs when the plugin is deleted from WordPress. Removes our options.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'chatrico_site_url' );
delete_option( 'chatrico_agent_id' );
delete_option( 'chatrico_enable_widget' );
delete_option( 'chatrico_hide_for_admins' );
delete_option( 'chatrico_token' );
delete_option( 'chatrico_account' );
delete_transient( 'chatrico_me' );
delete_transient( 'chatrico_login_error' );
