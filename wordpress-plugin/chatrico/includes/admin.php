<?php
/**
 * Admin menu + pages: Usage board, Agents, Inbox, Plans, Tickets.
 *
 * Every page shows the upgrade banner, and the plugin keeps pricing/usage in
 * front of the user to encourage upgrading. Pages that need account data ask
 * the user to log in first (on the Connect page).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function chatrico_register_menu() {
	$cap = 'manage_options';

	add_menu_page( 'Chatrico', 'Chatrico', $cap, 'chatrico', 'chatrico_render_settings_page', 'dashicons-format-chat', 58 );

	add_submenu_page( 'chatrico', 'Connect', 'Connect', $cap, 'chatrico', 'chatrico_render_settings_page' );
	add_submenu_page( 'chatrico', 'Usage', 'Usage', $cap, 'chatrico-usage', 'chatrico_render_usage_page' );
	add_submenu_page( 'chatrico', 'Agent', 'Agent', $cap, 'chatrico-agent', 'chatrico_render_agent_page' );
	add_submenu_page( 'chatrico', 'Inbox', 'Inbox', $cap, 'chatrico-inbox', 'chatrico_render_inbox_page' );
	add_submenu_page( 'chatrico', 'Plans', 'Plans ✨', $cap, 'chatrico-plans', 'chatrico_render_plans_page' );
	add_submenu_page( 'chatrico', 'Tickets & more', 'Tickets & more ↗', $cap, 'chatrico-tickets', 'chatrico_render_tickets_redirect' );
}
add_action( 'admin_menu', 'chatrico_register_menu' );

/**
 * Print a "log in first" notice and return false when not connected.
 *
 * @param string $title Page title.
 * @return bool True when logged in.
 */
function chatrico_guard_logged_in( $title ) {
	echo '<div class="wrap chatrico-wrap"><h1 class="chatrico-title"><span class="chatrico-logo">🤖</span> ' . esc_html( $title ) . '</h1>';
	if ( ! chatrico_is_logged_in() ) {
		echo '<div class="notice notice-warning chatrico-notice"><p>Please <a href="' . esc_url( admin_url( 'admin.php?page=chatrico' ) ) . '">log in to Chatrico</a> first.</p></div></div>';
		return false;
	}
	return true;
}

/* ─── Usage board ─────────────────────────────────────────────────────────── */

function chatrico_render_usage_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	if ( ! chatrico_guard_logged_in( 'Usage' ) ) {
		return;
	}

	$me    = chatrico_api_me();
	$plan  = ( is_array( $me ) && ! empty( $me['plan'] ) ) ? strtolower( $me['plan'] ) : 'free';
	$usage = ( is_array( $me ) && ! empty( $me['usage'] ) ) ? $me['usage'] : array();

	chatrico_upgrade_banner();
	?>
	<div class="chatrico-card">
		<div class="chatrico-view-head">
			<div>
				<h2>This month’s usage</h2>
				<p class="chatrico-sub">You’re on the <strong><?php echo esc_html( chatrico_plan_name( $plan ) ); ?></strong> plan.</p>
			</div>
			<span class="chatrico-plan-badge chatrico-plan-<?php echo esc_attr( $plan ); ?>"><?php echo esc_html( chatrico_plan_name( $plan ) ); ?></span>
		</div>

		<div class="chatrico-meters">
			<?php
			$rows = array(
				array( 'AI conversations', 'aiConversations' ),
				array( 'Contacts', 'contacts' ),
				array( 'AI agents', 'agents' ),
				array( 'Team seats', 'seats' ),
				array( 'Tickets', 'tickets' ),
			);
			foreach ( $rows as $row ) {
				$key = $row[1];
				if ( isset( $usage[ $key ] ) ) {
					$limit = array_key_exists( 'limit', $usage[ $key ] ) ? $usage[ $key ]['limit'] : null;
					chatrico_usage_meter( $row[0], isset( $usage[ $key ]['used'] ) ? $usage[ $key ]['used'] : 0, $limit );
				}
			}
			?>
		</div>
	</div>

	<div class="chatrico-card">
		<h2>Need more room? Upgrade your plan</h2>
		<p class="chatrico-sub">More AI conversations, more agents, human handoff, remove branding and more.</p>
		<?php chatrico_render_plans_grid( $plan ); ?>
	</div>
	<?php
}

/* ─── Agents ──────────────────────────────────────────────────────────────── */

function chatrico_render_agent_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	if ( ! chatrico_guard_logged_in( 'Agent' ) ) {
		return;
	}

	$me        = chatrico_api_me();
	$agents    = ( is_array( $me ) && ! empty( $me['agents'] ) ) ? $me['agents'] : array();
	$usage     = ( is_array( $me ) && ! empty( $me['usage'] ) ) ? $me['usage'] : array();
	$selected  = chatrico_agent_id();
	$agent_lim = isset( $usage['agents']['limit'] ) ? $usage['agents']['limit'] : null;
	$agent_use = isset( $usage['agents']['used'] ) ? (int) $usage['agents']['used'] : count( $agents );
	$at_limit  = ( null !== $agent_lim && $agent_use >= (int) $agent_lim );

	chatrico_upgrade_banner();
	?>
	<div class="chatrico-card">
		<div class="chatrico-view-head">
			<div><h2>Your AI agents</h2><p class="chatrico-sub">The highlighted agent is the one shown on this WordPress site.</p></div>
			<a class="button button-primary" href="<?php echo esc_url( chatrico_app_url( '/agents' ) ); ?>" target="_blank" rel="noopener">Manage on Chatrico ↗</a>
		</div>

		<?php if ( empty( $agents ) ) : ?>
			<p>No agents yet. <a href="<?php echo esc_url( chatrico_app_url( '/agents' ) ); ?>" target="_blank" rel="noopener">Create your first agent ↗</a>.</p>
		<?php else : ?>
			<ul class="chatrico-agent-list">
				<?php foreach ( $agents as $a ) : ?>
					<li class="chatrico-agent-item<?php echo ( (string) $a['id'] === $selected ) ? ' is-selected' : ''; ?>">
						<span class="chatrico-agent-dot" style="background: <?php echo esc_attr( ! empty( $a['widgetColor'] ) ? $a['widgetColor'] : '#6366f1' ); ?>;"></span>
						<span class="chatrico-agent-name"><?php echo esc_html( $a['name'] ); ?></span>
						<?php if ( (string) $a['id'] === $selected ) : ?><span class="chatrico-chip">On this site</span><?php endif; ?>
						<span class="chatrico-chip <?php echo empty( $a['isActive'] ) ? 'is-off' : 'is-on'; ?>"><?php echo empty( $a['isActive'] ) ? 'Inactive' : 'Active'; ?></span>
						<a class="chatrico-agent-edit" href="<?php echo esc_url( chatrico_app_url( '/agents' ) ); ?>" target="_blank" rel="noopener">Edit ↗</a>
					</li>
				<?php endforeach; ?>
			</ul>
			<p class="chatrico-sub">Pick which agent appears on your site on the <a href="<?php echo esc_url( admin_url( 'admin.php?page=chatrico' ) ); ?>">Connect</a> page.</p>
		<?php endif; ?>

		<?php if ( $at_limit ) : ?>
			<div class="chatrico-inline-upsell">
				<span>You’ve used all <?php echo esc_html( (int) $agent_lim ); ?> agents on your plan.</span>
				<a class="button button-primary" href="<?php echo esc_url( chatrico_upgrade_url( chatrico_next_plan() ? chatrico_next_plan() : 'pro' ) ); ?>" target="_blank" rel="noopener">Upgrade for more agents ↗</a>
			</div>
		<?php endif; ?>
	</div>
	<?php
}

/* ─── Inbox (embedded) ─────────────────────────────────────────────────────── */

function chatrico_render_inbox_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	if ( ! chatrico_guard_logged_in( 'Inbox' ) ) {
		return;
	}

	$embed_url = chatrico_app_url( '/inbox', true );
	$open_url  = chatrico_app_url( '/inbox', false );

	chatrico_upgrade_banner();
	?>
	<div class="chatrico-view-head">
		<div><p class="chatrico-sub">Live conversations. Reply or take over from the AI.</p></div>
		<a class="button button-primary" href="<?php echo esc_url( $open_url ); ?>" target="_blank" rel="noopener">Open Inbox in Chatrico ↗</a>
	</div>
	<div class="notice notice-info chatrico-notice chatrico-embed-hint">
		<p>If the panel below stays blank, your browser is blocking the embedded login — use <strong>Open Inbox in Chatrico ↗</strong> (you’ll need to be signed in to chatrico.com).</p>
	</div>
	<div class="chatrico-frame-wrap">
		<iframe class="chatrico-frame" src="<?php echo esc_url( $embed_url ); ?>" title="Chatrico Inbox" loading="lazy"></iframe>
	</div>
	<?php
}

/* ─── Plans ───────────────────────────────────────────────────────────────── */

function chatrico_render_plans_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$plan = chatrico_current_plan();
	?>
	<div class="wrap chatrico-wrap">
		<h1 class="chatrico-title"><span class="chatrico-logo">🤖</span> Plans &amp; pricing</h1>
		<p class="chatrico-sub">Pick the plan that fits. Upgrades open secure checkout on chatrico.com (card or crypto). Cancel anytime — your plan simply won’t renew.</p>
		<div class="chatrico-card">
			<?php chatrico_render_plans_grid( $plan ); ?>
		</div>
	</div>
	<?php
}

/* ─── Tickets & more (external) ────────────────────────────────────────────── */

function chatrico_render_tickets_redirect() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	?>
	<div class="wrap chatrico-wrap">
		<h1 class="chatrico-title"><span class="chatrico-logo">🤖</span> Tickets &amp; more</h1>
		<?php chatrico_upgrade_banner(); ?>
		<div class="chatrico-card">
			<p>Tickets, contacts, analytics and billing live in your full Chatrico dashboard.</p>
			<p>
				<a class="button button-primary" href="<?php echo esc_url( chatrico_app_url( '/tickets' ) ); ?>" target="_blank" rel="noopener">Open Tickets ↗</a>
				<a class="button" href="<?php echo esc_url( chatrico_app_url( '/dashboard' ) ); ?>" target="_blank" rel="noopener">Open full dashboard ↗</a>
			</p>
		</div>
	</div>
	<?php
}
