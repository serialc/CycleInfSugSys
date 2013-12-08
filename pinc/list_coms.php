<?php
// filename: list_coms.php
// gets comments, features - all of them

date_default_timezone_set('CET');

# load the class and object $dh
include('data_handler.php');

print(json_encode($dh->get_data()));

?>
