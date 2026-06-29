<?php
/**
 * Plugin Name:       Chatrico – AI Chat Bot & Live Chat
 * Plugin URI:        https://chatrico.com/wordpress-plugin
 * Description:        AI chat bot and live chat for your website. Answer customers 24/7, capture leads, hand off to a human, and track usage — set up in minutes.
 * Version:           1.0.0
 * Author:            aymen lasfar
 * Author URI:        https://chatrico.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       chatrico-ai-chat-bot-live-chat
 *
 * Chatrico is a hosted (SaaS) AI chat bot + live chat product. This plugin
 * connects your WordPress site to your Chatrico workspace — it does not run the
 * AI itself. Create a free account at https://chatrico.com (no credit card).
 */

// Block direct access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'CHATRICO_VERSION', '1.0.0' );
define( 'CHATRICO_PATH', plugin_dir_path( __FILE__ ) );
define( 'CHATRICO_URL', plugin_dir_url( __FILE__ ) );

// Default hosted platform URL. Users can override it in settings (useful for
// self-hosted/staging installs).
define( 'CHATRICO_DEFAULT_SITE', 'https://chatrico.com' );

require_once CHATRICO_PATH . 'includes/helpers.php';
require_once CHATRICO_PATH . 'includes/api.php';
require_once CHATRICO_PATH . 'includes/ui.php';
require_once CHATRICO_PATH . 'includes/settings.php';
require_once CHATRICO_PATH . 'includes/widget.php';
require_once CHATRICO_PATH . 'includes/admin.php';

/**
 * Set sensible defaults on activation.
 */
function chatrico_activate() {
	add_option( 'chatrico_site_url', CHATRICO_DEFAULT_SITE );
	add_option( 'chatrico_agent_id', '' );
	add_option( 'chatrico_enable_widget', '1' );
	add_option( 'chatrico_hide_for_admins', '0' );
	add_option( 'chatrico_token', '' );
	add_option( 'chatrico_account', array() );
}
register_activation_hook( __FILE__, 'chatrico_activate' );

// Load admin styles only on our own pages.
add_action(
	'admin_enqueue_scripts',
	function ( $hook ) {
		if ( strpos( (string) $hook, 'chatrico' ) === false ) {
			return;
		}
		wp_enqueue_style( 'chatrico-admin', CHATRICO_URL . 'assets/admin.css', array(), CHATRICO_VERSION );
	}
);
