<?php
/**
 * Loads the Chatrico chat widget on the front end via the WordPress script
 * queue (wp_enqueue_script), as required by the plugin guidelines.
 *
 * It enqueues {site}/widget/embed.js and adds the configuration object
 *   window.ChatBotProConfig = { agentId, apiBase }
 * as an inline "before" script so it's set before the widget loads.
 *
 * Appearance (color, position, size, theme) is managed in Agent Settings on
 * chatrico.com and applied automatically — nothing to configure here.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function chatrico_enqueue_widget() {
	// Never load on wp-admin screens.
	if ( is_admin() ) {
		return;
	}

	// Respect the on/off toggle and require an Agent ID.
	if ( '1' !== get_option( 'chatrico_enable_widget', '1' ) || ! chatrico_is_connected() ) {
		return;
	}

	// Optionally hide the widget for logged-in administrators while testing.
	if ( '1' === get_option( 'chatrico_hide_for_admins', '0' ) && current_user_can( 'manage_options' ) ) {
		return;
	}

	$agent_id = chatrico_agent_id();
	$api_base = chatrico_site_url() . '/api';
	$embed_js = chatrico_site_url() . '/widget/embed.js';

	wp_enqueue_script( 'chatrico-widget', $embed_js, array(), CHATRICO_VERSION, true );

	$config = wp_json_encode( array( 'agentId' => $agent_id, 'apiBase' => $api_base ) );
	wp_add_inline_script( 'chatrico-widget', 'window.ChatBotProConfig = ' . $config . ';', 'before' );
}
add_action( 'wp_enqueue_scripts', 'chatrico_enqueue_widget' );

/**
 * Load the widget script with `defer` so it never blocks page rendering.
 *
 * @param string $tag    The full <script> tag.
 * @param string $handle The script handle.
 * @return string
 */
function chatrico_widget_script_tag( $tag, $handle ) {
	if ( 'chatrico-widget' === $handle && false === strpos( $tag, ' defer' ) ) {
		$tag = str_replace( ' src=', ' defer src=', $tag );
	}
	return $tag;
}
add_filter( 'script_loader_tag', 'chatrico_widget_script_tag', 10, 2 );
