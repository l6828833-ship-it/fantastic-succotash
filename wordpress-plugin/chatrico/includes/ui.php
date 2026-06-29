<?php
/**
 * Shared UI: pricing data, the upgrade banner, plan badge and usage meters.
 * These are reused on every plugin page so upgrade prompts appear everywhere.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Pricing plans (kept in sync with chatrico.com).
 *
 * @return array
 */
function chatrico_plans() {
	return array(
		array(
			'id'        => 'free',
			'name'      => 'Free',
			'price'     => '$0',
			'period'    => '',
			'highlight' => false,
			'features'  => array( '1 AI agent', '50 AI conversations / mo', '30 contacts', '30 tickets / mo', 'Basic analytics' ),
		),
		array(
			'id'        => 'starter',
			'name'      => 'Starter',
			'price'     => '$9.99',
			'period'    => '/mo',
			'highlight' => false,
			'features'  => array( '2 AI agents', '1,000 AI conversations / mo', '1,000 contacts', 'Human handoff & live inbox', 'Remove branding' ),
		),
		array(
			'id'        => 'pro',
			'name'      => 'Pro',
			'price'     => '$49',
			'period'    => '/mo',
			'highlight' => true,
			'features'  => array( '5 AI agents', '6,000 AI conversations / mo', '5,000 contacts', 'Email branding + CSV export', 'Advanced analytics', '10 team seats' ),
		),
		array(
			'id'        => 'business',
			'name'      => 'Business',
			'price'     => '$129',
			'period'    => '/mo',
			'highlight' => false,
			'features'  => array( '15 AI agents', '20,000 AI conversations / mo', '25,000 contacts', '25 team seats', 'Priority support + onboarding' ),
		),
	);
}

/**
 * Human-friendly plan name.
 *
 * @param string $plan Plan id.
 * @return string
 */
function chatrico_plan_name( $plan ) {
	$names = array(
		'free'       => 'Free',
		'starter'    => 'Starter',
		'pro'        => 'Pro',
		'business'   => 'Business',
		'enterprise' => 'Enterprise',
	);
	$plan = strtolower( (string) $plan );
	return isset( $names[ $plan ] ) ? $names[ $plan ] : ucfirst( $plan );
}

/**
 * Deep link that opens the Chatrico checkout for a plan.
 *
 * @param string $plan Plan id.
 * @return string
 */
function chatrico_upgrade_url( $plan ) {
	return chatrico_app_url( '/settings?upgrade=' . rawurlencode( $plan ) );
}

/**
 * The current plan from the cached snapshot ('free' when unknown).
 *
 * @return string
 */
function chatrico_current_plan() {
	$me = chatrico_api_me();
	return ( is_array( $me ) && ! empty( $me['plan'] ) ) ? strtolower( $me['plan'] ) : 'free';
}

/**
 * The next plan up from the current one, or '' when already at the top.
 *
 * @return string
 */
function chatrico_next_plan() {
	$order = array( 'free', 'starter', 'pro', 'business' );
	$idx   = array_search( chatrico_current_plan(), $order, true );
	if ( false === $idx || $idx >= count( $order ) - 1 ) {
		return '';
	}
	return $order[ $idx + 1 ];
}

/**
 * The persistent "upgrade" banner shown at the top of every plugin page
 * (hidden only on the top-tier plans).
 */
function chatrico_upgrade_banner() {
	$plan = chatrico_current_plan();
	if ( in_array( $plan, array( 'business', 'enterprise' ), true ) ) {
		return;
	}
	$next      = chatrico_next_plan();
	$next_name = $next ? chatrico_plan_name( $next ) : 'Pro';
	$next      = $next ? $next : 'pro';
	$plans_url = admin_url( 'admin.php?page=chatrico-plans' );
	?>
	<div class="chatrico-upgrade-banner">
		<div class="chatrico-ub-text">
			<strong>You’re on the <?php echo esc_html( chatrico_plan_name( $plan ) ); ?> plan.</strong>
			Upgrade to <strong><?php echo esc_html( $next_name ); ?></strong> for more AI conversations, more agents and premium features.
		</div>
		<div class="chatrico-ub-actions">
			<a class="button button-primary" href="<?php echo esc_url( chatrico_upgrade_url( $next ) ); ?>" target="_blank" rel="noopener">Upgrade now ↗</a>
			<a class="button" href="<?php echo esc_url( $plans_url ); ?>">Compare plans</a>
		</div>
	</div>
	<?php
}

/**
 * Render a single usage meter (used / limit) with a progress bar.
 *
 * @param string   $label Metric label.
 * @param int      $used  Amount used.
 * @param int|null $limit Limit, or null for unlimited.
 */
function chatrico_usage_meter( $label, $used, $limit ) {
	$used      = (int) $used;
	$unlimited = ( null === $limit );
	$limit_txt = $unlimited ? 'Unlimited' : number_format_i18n( (int) $limit );
	$pct       = ( ! $unlimited && $limit > 0 ) ? min( 100, round( ( $used / $limit ) * 100 ) ) : 0;
	$near      = ( $pct >= 80 );
	?>
	<div class="chatrico-meter">
		<div class="chatrico-meter-head">
			<span class="chatrico-meter-label"><?php echo esc_html( $label ); ?></span>
			<span class="chatrico-meter-num"><?php echo esc_html( number_format_i18n( $used ) ); ?> / <?php echo esc_html( $limit_txt ); ?></span>
		</div>
		<div class="chatrico-meter-track">
			<div class="chatrico-meter-fill<?php echo $near ? ' is-near' : ''; ?>" style="width: <?php echo esc_attr( $unlimited ? 6 : $pct ); ?>%;"></div>
		</div>
	</div>
	<?php
}

/**
 * Render the pricing cards grid (used on the Plans page and Usage board).
 *
 * @param string $current Current plan id (to mark the active card).
 */
function chatrico_render_plans_grid( $current ) {
	$current = strtolower( (string) $current );
	?>
	<div class="chatrico-plans-grid">
		<?php foreach ( chatrico_plans() as $p ) : ?>
			<?php
			$is_current = ( $p['id'] === $current );
			$classes    = 'chatrico-plan-card';
			if ( $p['highlight'] ) {
				$classes .= ' is-highlight';
			}
			if ( $is_current ) {
				$classes .= ' is-current';
			}
			?>
			<div class="<?php echo esc_attr( $classes ); ?>">
				<?php if ( $p['highlight'] ) : ?><span class="chatrico-plan-tag">Most popular</span><?php endif; ?>
				<h3><?php echo esc_html( $p['name'] ); ?></h3>
				<div class="chatrico-plan-price"><?php echo esc_html( $p['price'] ); ?><span><?php echo esc_html( $p['period'] ); ?></span></div>
				<ul>
					<?php foreach ( $p['features'] as $f ) : ?>
						<li><?php echo esc_html( $f ); ?></li>
					<?php endforeach; ?>
				</ul>
				<?php if ( $is_current ) : ?>
					<button class="button" disabled>Current plan</button>
				<?php elseif ( 'free' === $p['id'] ) : ?>
					<span class="chatrico-plan-foot">Included free</span>
				<?php else : ?>
					<a class="button button-primary" href="<?php echo esc_url( chatrico_upgrade_url( $p['id'] ) ); ?>" target="_blank" rel="noopener">Upgrade ↗</a>
				<?php endif; ?>
			</div>
		<?php endforeach; ?>
	</div>
	<?php
}
