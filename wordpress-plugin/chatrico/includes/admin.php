<?php
/**
 * Admin menu + the embedded dashboard views (Analytics, Agent, Inbox).
 *
 * The views are simply the matching Chatrico pages loaded in an iframe in
 * "embed" mode (?embed=1) so they render without the app's own sidebar.
 * Because Chatrico uses a login session, some privacy-focused browsers block
 * third-party cookies inside iframes — so every view also has an
 * "Open in Chatrico" button that always works.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the top-level "Chatrico" menu and its sub-pages.
 */
function chatrico_register_menu() {
	$cap = 'manage_options';

	add_menu_page(
		'Chatrico',
		'Chatrico',
		$cap,
		'chatrico',
		'chatrico_render_settings_page',
		'dashicons-format-chat',
		58
	);

	// Rename the auto-created first submenu from "Chatrico" to "Connect".
	add_submenu_page( 'chatrico', 'Connect', 'Connect', $cap, 'chatrico', 'chatrico_render_settings_page' );
	add_submenu_page( 'chatrico', 'Analytics', 'Analytics', $cap, 'chatrico-analytics', 'chatrico_render_analytics_page' );
	add_submenu_page( 'chatrico', 'Agent', 'Agent', $cap, 'chatrico-agent', 'chatrico_render_agent_page' );
	add_submenu_page( 'chatrico', 'Inbox', 'Inbox', $cap, 'chatrico-inbox', 'chatrico_render_inbox_page' );

	// "Tickets & more" jumps straight to the full app (new tab) — handled below.
	add_submenu_page( 'chatrico', 'Tickets & more', 'Tickets & more ↗', $cap, 'chatrico-tickets', 'chatrico_render_tickets_redirect' );
}
add_action( 'admin_menu', 'chatrico_register_menu' );

/**
 * Shared renderer for an embedded Chatrico view.
 *
 * @param string $title    Heading shown above the iframe.
 * @param string $app_path Path in the Chatrico app, e.g. "/analytics".
 * @param string $desc     Short description line.
 */
function chatrico_render_embed_view( $title, $app_path, $desc ) {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	// Not connected yet → nudge to the Connect page.
	if ( ! chatrico_is_connected() ) {
		echo '<div class="wrap chatrico-wrap"><h1 class="chatrico-title"><span class="chatrico-logo">🤖</span> ' . esc_html( $title ) . '</h1>';
		echo '<div class="notice notice-warning chatrico-notice"><p>Connect your Agent ID first on the <a href="' . esc_url( admin_url( 'admin.php?page=chatrico' ) ) . '">Connect</a> page.</p></div></div>';
		return;
	}

	$embed_url = chatrico_app_url( $app_path, true );
	$open_url  = chatrico_app_url( $app_path, false );
	?>
	<div class="wrap chatrico-wrap">
		<div class="chatrico-view-head">
			<div>
				<h1 class="chatrico-title"><span class="chatrico-logo">🤖</span> <?php echo esc_html( $title ); ?></h1>
				<p class="chatrico-sub"><?php echo esc_html( $desc ); ?></p>
			</div>
			<a class="button button-primary" href="<?php echo esc_url( $open_url ); ?>" target="_blank" rel="noopener">Open in Chatrico ↗</a>
		</div>

		<div class="notice notice-info chatrico-notice chatrico-embed-hint">
			<p>If the panel below stays blank, your browser is blocking the embedded login. Just use <strong>Open in Chatrico ↗</strong> — you’ll need to be signed in to chatrico.com.</p>
		</div>

		<div class="chatrico-frame-wrap">
			<iframe
				class="chatrico-frame"
				src="<?php echo esc_url( $embed_url ); ?>"
				title="<?php echo esc_attr( $title ); ?>"
				loading="lazy"
			></iframe>
		</div>
	</div>
	<?php
}

function chatrico_render_analytics_page() {
	chatrico_render_embed_view( 'Analytics', '/analytics', 'Conversations, resolution rate and trends for your agent.' );
}

function chatrico_render_agent_page() {
	chatrico_render_embed_view( 'Agent', '/agents', 'Edit your AI agent — prompt, behavior, knowledge and style.' );
}

function chatrico_render_inbox_page() {
	chatrico_render_embed_view( 'Inbox', '/inbox', 'Live conversations. Reply or take over from the AI.' );
}

/**
 * Tickets & more: send the admin to the full app in a new tab.
 */
function chatrico_render_tickets_redirect() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$tickets_url = chatrico_app_url( '/tickets', false );
	$dash_url    = chatrico_app_url( '/dashboard', false );
	?>
	<div class="wrap chatrico-wrap">
		<h1 class="chatrico-title"><span class="chatrico-logo">🤖</span> Tickets &amp; more</h1>
		<div class="chatrico-card">
			<p>Tickets, contacts, billing and the rest of your tools live in the full Chatrico dashboard.</p>
			<p>
				<a class="button button-primary" href="<?php echo esc_url( $tickets_url ); ?>" target="_blank" rel="noopener">Open Tickets ↗</a>
				<a class="button" href="<?php echo esc_url( $dash_url ); ?>" target="_blank" rel="noopener">Open full dashboard ↗</a>
			</p>
		</div>
	</div>
	<?php
}
