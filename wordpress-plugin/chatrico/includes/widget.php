<?php
/**
 * Injects the Chatrico chat widget into the site footer on the front end.
 *
 * This mirrors the official embed snippet:
 *   window.ChatBotProConfig = { agentId, apiBase }
 *   <script src="{site}/widget/embed.js" async defer></script>
 *
 * Appearance (color, position, size, theme) is managed in Agent Settings on
 * chatrico.com and applied automatically — nothing to configure here.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function chatrico_render_widget() {
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
	?>
	<!-- Chatrico Widget -->
	<script>
		window.ChatBotProConfig = {
			agentId: "<?php echo esc_js( $agent_id ); ?>",
			apiBase: "<?php echo esc_js( $api_base ); ?>"
		};
	</script>
	<script src="<?php echo esc_url( $embed_js ); ?>" async defer></script>
	<?php
}
add_action( 'wp_footer', 'chatrico_render_widget' );
