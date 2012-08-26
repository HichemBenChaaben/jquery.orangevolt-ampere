<?php
	error_reporting(E_ALL);
  	ini_set( 'display_errors', 'On');

  	include __DIR__ . '/../bootstrap.php';	
  	
	define( 'PATHINFO', @$_SERVER['PATH_INFO'] ?: '/');
	
	if( PATHINFO!='/') {
		ob_start();
		require_once 'examples/' . PATHINFO . '/index.php';
		$output = ob_get_clean();
	}
?>
<!doctype html>
<!--[if lt IE 7]> <html class="no-js lt-ie9 lt-ie8 lt-ie7" lang="en"> <![endif]-->
<!--[if IE 7]>    <html class="no-js lt-ie9 lt-ie8" lang="en"> <![endif]-->
<!--[if IE 8]>    <html class="no-js lt-ie9" lang="en"> <![endif]-->
<!--[if gt IE 8]><!--> <html class="no-js" lang="en"> <!--<![endif]-->
	<head>
		<meta charset="utf-8">
		<meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
	
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<link rel="icon" href="favicon.ico" type="image/x-icon">
		<link rel="shortcut icon" href="favicon.ico" type="image/x-icon">
	
	 	<!--[if lte IE 8]>
	    <script>
	    	/*
	      document.createElement('tabs');
	      document.createElement('pane');
	      document.createElement('ng-pluralize');
	      	*/
	    </script>
		<![endif]-->
		
		<?php
			foreach( $CSS as $css) {
				echo "\t<link rel=\"stylesheet\" href=\"$css\">" . PHP_EOL;
			} 
 
			foreach( $LESS as $less) {
				echo "\t<link rel=\"stylesheet/less\" type=\"text/css\" href=\"$less\">" . PHP_EOL;
			}
			
			foreach( $JS as $js) {
				echo "\t<script type=\"text/javascript\" src=\"$js\"></script>" . PHP_EOL;
			}
		?>		
 	</head>
 	<body>
  		<!-- Prompt IE 6 users to install Chrome Frame. Remove this if you support IE 6.
       		chromium.org/developers/how-tos/chrome-frame-getting-started -->
  		<!--[if lt IE 7]><p class=chromeframe>Your browser is <em>ancient!</em> <a href="http://browsehappy.com/">Upgrade to a different browser</a> or <a href="http://www.google.com/chromeframe/?redirect=true">install Google Chrome Frame</a> to experience this site.</p><![endif]-->
  		
  		<?php 
  			if( PATHINFO=='/') {
  				echo <<<EOS
	  	<div class="navbar navbar-fixed-top">
	      <div class="navbar-inner">
	        <div class="container">
	          <a class="btn btn-navbar" data-toggle="collapse" data-target=".nav-collapse">
	            <span class="icon-bar"></span>
	            <span class="icon-bar"></span>
	            <span class="icon-bar"></span>
	          </a>
	          <a class="brand" href="#">bootstrap-angular-template</a>
	          
	          <div class="nav-collapse">
	            <ul class="nav">
	              <li class="active"><a href="#">Home</a></li>
	              <li><a href="#about">About</a></li>
	              <li><a href="#contact">Contact</a></li>
	            </ul>
	          </div>
	          
	        </div>
	      </div>
	    </div>
	    
	    <div class="container" style="padding-top: 60px;">
	    	<div class="hero-unit">
	    		<center><h2>Click an link below to start.</h2></center>
	    	</div>
	    	<div>
EOS
				;
				
  				$iterator = new DirectoryIterator( __DIR__ . '/examples');
			    foreach( $iterator as $fi) {
			        if( $fi->isDir() && !$fi->isDot()) {
			            echo "<div><a target=\"_blank\" href=\"index.php/{$fi->getFilename()}\">{$fi->getFilename()}</a></div>" . PHP_EOL;
			        }
			    }
			    
			    ECHO <<<EOS
			</div>
			<hr>
			<footer id="about">
			    <p>© <a href="http://cm4all.com">Content Management AG 2012</a></p>
			</footer>
		</div>
EOS
				;
  			} else {
  				echo $output;
  			}
  		?>
	</body>
</html>